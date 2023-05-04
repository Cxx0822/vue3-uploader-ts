import { File } from 'buffer'

export interface EventDataIF {
    [key: string]: Function
}

export interface UploaderOptionsIF {
    chunkSize?: number
    simultaneousUploads?: number
    singleFile?: boolean
    fileParameterName?: string
    progressCallbacksInterval?: number
    speedSmoothingFactor?: number
    query?: {}
    headers?: {}
    withCredentials?: boolean
    preprocess?: Function
    method?: string
    testMethod?: string
    uploadMethod?: string
    prioritizeFirstAndLastChunk?: boolean
    allowDuplicateUploads?: boolean
    target?: string
    testChunks?: boolean
    generateUniqueIdentifier?: (file: File)=>{}
    maxChunkRetries?: number
    chunkRetryInterval?: null
    permanentErrors?: number[]
    successStatuses?: number[]
    onDropStopPropagation?: boolean
    initFileFn?: null
    checkChunkUploadedByResponse?: null
    initialPaused?: boolean
}
