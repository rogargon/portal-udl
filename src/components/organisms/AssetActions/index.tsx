import React, { ReactElement, useState, useEffect } from 'react'
import Permission from '../Permission'
import styles from './index.module.css'
import Compute from './Compute'
import Consume from './Consume'
import { Logger, File as FileMetadata, DID } from '@oceanprotocol/lib'
import Tabs from '../../atoms/Tabs'
import compareAsBN from '../../../utils/compareAsBN'
import Pool from './Pool'
import Trade from './Trade'
import { useAsset } from '../../../providers/Asset'
import { useOcean } from '../../../providers/Ocean'
import { useWeb3 } from '../../../providers/Web3'
import Web3Feedback from '../../molecules/Web3Feedback'
import { getFileInfo } from '../../../utils/provider'
import { getOceanConfig } from '../../../utils/ocean'
import { useCancelToken } from '../../../hooks/useCancelToken'
import { useIsMounted } from '../../../hooks/useIsMounted'
import { useSiteMetadata } from '../../../hooks/useSiteMetadata'
import { graphql, useStaticQuery } from 'gatsby'

const query = graphql`
  query {
    content: allFile(filter: { relativePath: { eq: "assetDisclaimer.json" } }) {
      edges {
        node {
          childContentJson {
            message
          }
        }
      }
    }
  }
`

interface DisclaimerData {
  content: {
    edges: {
      node: {
        childContentJson: {
          message: string
        }
      }
    }[]
  }
}

export default function AssetActions(): ReactElement {
  const data: DisclaimerData = useStaticQuery(query)
  const { message } = data.content.edges[0].node.childContentJson

  const { accountId, balance } = useWeb3()
  const { ocean, account } = useOcean()
  const { price, ddo, isAssetNetwork } = useAsset()

  const [isBalanceSufficient, setIsBalanceSufficient] = useState<boolean>()
  const [dtBalance, setDtBalance] = useState<string>()
  const [fileMetadata, setFileMetadata] = useState<FileMetadata>(Object)
  const [fileIsLoading, setFileIsLoading] = useState<boolean>(false)
  const isCompute = Boolean(ddo?.findServiceByType('compute'))

  const [isConsumable, setIsConsumable] = useState<boolean>(true)
  const [consumableFeedback, setConsumableFeedback] = useState<string>('')
  const newCancelToken = useCancelToken()
  const isMounted = useIsMounted()

  const { allowDynamicPricing } = useSiteMetadata().appConfig

  useEffect(() => {
    if (!ddo || !accountId || !ocean || !isAssetNetwork) return

    async function checkIsConsumable() {
      const consumable = await ocean.assets.isConsumable(
        ddo,
        accountId.toLowerCase()
      )
      if (consumable) {
        setIsConsumable(consumable.result)
        setConsumableFeedback(consumable.message)
      }
    }
    checkIsConsumable()
  }, [accountId, isAssetNetwork, ddo, ocean])

  useEffect(() => {
    const oceanConfig = getOceanConfig(ddo.chainId)
    if (!oceanConfig) return

    async function initFileInfo() {
      setFileIsLoading(true)
      try {
        const fileInfoResponse = await getFileInfo(
          DID.parse(`${ddo.id}`),
          oceanConfig.providerUri,
          newCancelToken()
        )
        fileInfoResponse && setFileMetadata(fileInfoResponse[0])
        isMounted() && setFileIsLoading(false)
      } catch (error) {
        Logger.error(error.message)
      }
    }
    initFileInfo()
  }, [ddo, isMounted, newCancelToken])

  // Get and set user DT balance
  useEffect(() => {
    if (!ocean || !accountId || !isAssetNetwork) return
    async function init() {
      try {
        const dtBalance = await ocean.datatokens.balance(
          ddo.dataToken,
          accountId
        )
        setDtBalance(dtBalance)
      } catch (e) {
        Logger.error(e.message)
      }
    }
    init()
  }, [ocean, accountId, ddo.dataToken, isAssetNetwork])

  // Check user balance against price
  useEffect(() => {
    if (price?.type === 'free') setIsBalanceSufficient(true)
    if (!price?.value || !account || !balance?.ocean || !dtBalance) return

    setIsBalanceSufficient(
      compareAsBN(balance.ocean, `${price.value}`) || Number(dtBalance) >= 1
    )

    return () => {
      setIsBalanceSufficient(false)
    }
  }, [balance, account, price, dtBalance])

  const UseContent = isCompute ? (
    <Compute
      dtBalance={dtBalance}
      file={fileMetadata}
      fileIsLoading={fileIsLoading}
      isConsumable={isConsumable}
      consumableFeedback={consumableFeedback}
      computeDisclaimerMessage={message}
    />
  ) : (
    <Consume
      ddo={ddo}
      dtBalance={dtBalance}
      isBalanceSufficient={isBalanceSufficient}
      file={fileMetadata}
      fileIsLoading={fileIsLoading}
      isConsumable={isConsumable}
      consumableFeedback={consumableFeedback}
      consumeDisclaimerMessage={message}
    />
  )

  const tabs = [
    {
      title: 'Use',
      content: UseContent
    }
  ]

  price?.type === 'pool' &&
    allowDynamicPricing === 'true' &&
    tabs.push(
      {
        title: 'Pool',
        content: <Pool />
      },
      {
        title: 'Trade',
        content: <Trade />
      }
    )

  return (
    <>
      <Permission eventType="consume">
        <Tabs items={tabs} className={styles.actions} />
      </Permission>
      <Web3Feedback isAssetNetwork={isAssetNetwork} />
    </>
  )
}
