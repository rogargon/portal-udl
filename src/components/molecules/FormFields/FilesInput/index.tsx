import React, { ReactElement, useState, useEffect } from 'react'
import { useField } from 'formik'
import { toast } from 'react-toastify'
import FileInfo from './Info'
import CustomInput from '../URLInput/Input'
import { InputProps } from '../../../atoms/Input'
import { fileinfo } from '../../../../utils/provider'
import { useWeb3 } from '../../../../providers/Web3'
import { getOceanConfig } from '../../../../utils/ocean'
import { useCancelToken } from '../../../../hooks/useCancelToken'
import { GEN_X_NETWORK_ID } from '../../../../../chains.config'

export default function FilesInput(props: InputProps): ReactElement {
  const [field, meta, helpers] = useField(props.name)
  const [isLoading, setIsLoading] = useState(false)
  const [fileUrl, setFileUrl] = useState<string>()
  const { chainId } = useWeb3()
  const newCancelToken = useCancelToken()

  function loadFileInfo() {
    const config = getOceanConfig(chainId || GEN_X_NETWORK_ID)

    async function validateUrl() {
      try {
        setIsLoading(true)
        const checkedFile = await fileinfo(
          fileUrl,
          config?.providerUri,
          newCancelToken()
        )
        checkedFile && helpers.setValue([checkedFile])
      } catch (error) {
        toast.error('Could not fetch file info. Please check URL and try again')
        console.error(error.message)
      } finally {
        setIsLoading(false)
      }
    }

    fileUrl && validateUrl()
  }

  useEffect(() => {
    loadFileInfo()
  }, [fileUrl])

  async function handleButtonClick(e: React.SyntheticEvent, url: string) {
    // hack so the onBlur-triggered validation does not show,
    // like when this field is required
    helpers.setTouched(false)

    // File example 'https://oceanprotocol.com/tech-whitepaper.pdf'
    e.preventDefault()

    // In the case when the user re-add the same URL after it was removed (by accident or intentionally)
    if (fileUrl === url) {
      loadFileInfo()
    }

    setFileUrl(url)
  }

  return (
    <>
      {field?.value && field.value[0] && typeof field.value === 'object' ? (
        <FileInfo name={props.name} file={field.value[0]} />
      ) : (
        <CustomInput
          submitText="Add File"
          {...props}
          {...field}
          isLoading={isLoading}
          handleButtonClick={handleButtonClick}
        />
      )}
    </>
  )
}
