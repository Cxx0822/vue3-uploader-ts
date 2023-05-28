// 事件数据接口
export interface EventDataIF {
    [key: string]: Function
}

// 上传器用户配置接口
export interface UploaderUserOptionsIF {
    // 文件最大大小
    fileMaxSize?: number
    // 文件块大小
    chunkSize?: number
    // 同时上传的文件块个数
    simultaneousUploads?: number
    // 最大重试上传次数
    maxChunkRetries?: number
    // 是否是单文件
    isSingleFile?: boolean
    // 自定义响应成功状态码
    successCode?: number[]
    // 文件类型列表
    fileTypeLimit?: string[]
    // 是否自动下载
    isAutoStart?: boolean
    // 自定义请求头
    headers?: {}
    // 上传文件块url
    uploadUrl: string,
    // 合并文件url
    mergeUrl: string,
    // 后端数据MultipartFile字段的名称
    fileParameterName: string
    // 文件上传地址
    uploadFolderPath: string
}

// 上传器默认配置接口
export interface UploaderDefaultOptionsIF {
    // 文件最大大小
    fileMaxSize: number
    // 文件块大小
    chunkSize: number
    // 同时上传的文件块个数
    simultaneousUploads: number
    // 最大重试上传次数
    maxChunkRetries: number
    // 是否是单文件
    isSingleFile: boolean
    // 自定义响应成功状态码
    successCode: number[]
    // 文件类型列表
    fileTypeLimit: string[]
    // 是否自动下载
    isAutoStart: boolean
    // 自定义请求头
    headers?: {}
    // 上传文件块url
    uploadUrl: string,
    // 合并文件url
    mergeUrl: string,
    // 后端数据MultipartFile字段的名称
    fileParameterName: string
    // 文件上传地址
    uploadFolderPath: string
}

// 上传文件信息接口
export interface UploaderFileInfoIF {
    // 文件名称
    name:string
    // 文件大小
    size:number
    // 当前上传速度 单位kb/s
    currentSpeed:number
    // 当前进度 单位 %
    currentProgress:number
    // 剩余时间 单位 s
    timeRemaining:number
    // 文件唯一标识
    uniqueIdentifier:string
    // 当前状态
    state: STATUS
    // 是否暂停
    isPause: boolean
    // 信息
    message: string
}

// 上传文件参数信息接口
export interface FileParamIF {
    chunkNumber: number,
    chunkSize?: number,
    currentChunkSize?: number,
    totalSize: number,
    identifier: string,
    filename: string,
    fileType: string
    relativePath: string,
    totalChunks: number,
}

/**
 * 上传文件块返回结果
 */
export interface ChunkResultTF {
    // 是否可以跳过上传
    skipUpload:boolean

    // 已经上传的文件块列表
    uploadedChunkList:number[]
}

// 下载器默认配置接口
export interface DownloaderDefaultOptionsIF {
    // 文件块大小
    chunkSize: number
    // 同时上传的文件块个数
    simultaneousDownloads: number
    // 最大重试上传次数
    maxChunkRetries: number
    // 是否自动下载
    isAutoStart: boolean
    // 自定义请求头
    headers?: {}
    // 获取文件信息接口
    getFileInfoUrl: string,
    // 下载文件块接口
    downloadChunkUrl: string,
    // 下载文件名
    fileName: string
    // 文件下载地址
    downloadFolderPath: string
}

// 文件或文件块上传状态
export const enum STATUS {
    // 等待处理
    PENDING = '文件等待上传',
    // 上传中
    PROGRESS = '文件上传中',
    // 上传成功
    SUCCESS = '文件上传成功',
    // 上传出错
    ERROR = '文件上传出错',
    // 重新上传
    RETRY = '文件重新上传',
    // 暂停上传
    ABORT = '文件暂停上传'
}
