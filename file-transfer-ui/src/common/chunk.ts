import { FileParamIF, STATUS, UploaderDefaultOptionsIF } from '../types'
import { MyEvent } from './myEvent'
import axios from 'axios'

/**
 * 上传块类 利用Axios发送网络请求
 * 1. 根据文件计算需要上传的文件块
 * 2. 预处理文件
 * 3. 发送数据
 */
export class Chunk extends MyEvent {
  // 文件
  private file:File
  // 上传器配置项
  private uploaderOption:UploaderDefaultOptionsIF
  // 文件参数
  private fileParam:FileParamIF
  // 第几个文件块
  private readonly offset:number
  // 文件块大小
  private readonly chunkSize:number
  // 起始字节
  public readonly startByte:number
  // 终止字节
  public readonly endByte:number
  // 文件字节
  private readonly bytes:Blob
  // 当前状态
  public status:STATUS
  // 已上传字节数
  private loaded:number
  // 一共需要上传的字节数
  private total:number
  // 开始上传时间
  public startTime:number
  private controller

  /**
   * 构造函数
   * @param file 文件
   * @param uploaderOption 上传器选项
   * @param fileParam 文件参数
   * @param offset 第几文件块
   */
  constructor(file: File, uploaderOption: UploaderDefaultOptionsIF,
    fileParam: FileParamIF, offset: number) {
    super()
    this.file = file
    this.uploaderOption = uploaderOption
    this.fileParam = fileParam
    this.offset = offset

    this.chunkSize = this.uploaderOption.chunkSize
    this.startByte = this.computeStartByte()
    this.endByte = this.computeEndByte()
    this.status = STATUS.PENDING
    this.loaded = 0
    this.total = 0
    this.startTime = Date.now()

    this.controller = new AbortController()

    // 切分文件 获取字节数
    this.bytes = this.file.slice(this.startByte, this.endByte, this.fileParam.fileType)
  }

  /**
   * 计算起始字节数
   * @returns 字节数
   */
  private computeStartByte():number {
    return this.offset * this.chunkSize
  }

  /**
   * 计算终止字节数
   * @returns 字节数
   */
  private computeEndByte():number {
    let endByte = (this.offset + 1) * this.chunkSize

    // 已经到达文件末尾
    if (endByte > this.fileParam.totalSize) {
      endByte = this.fileParam.totalSize
    }

    return endByte
  }

  /**
   * 获取需要发送的后端信息
   * @returns 参数信息 对应后端数据
   */
  private getParams() {
    return {
      chunkNumber: this.offset + 1,
      chunkSize: this.chunkSize,
      currentChunkSize: this.endByte - this.startByte,
      totalSize: this.fileParam.totalSize,
      identifier: this.fileParam.identifier,
      filename: this.fileParam.filename,
      relativePath: this.fileParam.relativePath,
      totalChunks: this.fileParam.totalChunks,
    }
  }

  /**
   * 计算文件块上传速度
   * @returns 文件块上传速度 单位 kb/s 即b/ms
   */
  public measureSpeed() {
    let chunkSpeed = 0
    // 如果正在上传
    if (this.status === STATUS.PROGRESS) {
      // 当前上传的字节数 / 已上传时间
      chunkSpeed = this.sizeUploaded() / (Date.now() - this.startTime)
    }

    return chunkSpeed
  }

  /**
   * 计算已上传字节数
   * @returns 已上传字节数
   */
  public sizeUploaded():number {
    let size = this.endByte - this.startByte
    // 如果没有上传成功 则需要乘上当前进度系数
    size = this.chunkProgress() * size

    return size
  }

  /**
   * 获取当前进度
   * @returns 当前文件块进度
   */
  public chunkProgress():number {
    let chunkProgress
    switch (this.status) {
      // 上传成功则为1
      case STATUS.SUCCESS:
        chunkProgress = 1
        break
        // 正在上传中
      case STATUS.PROGRESS:
        chunkProgress = this.total > 0 ? this.loaded / this.total : 0
        break
        // 其余情况均为0
      default:
        chunkProgress = 0
        break
    }

    return chunkProgress
  }

  /**
   * 传输中事件处理
   * @param event 传输中事件
   */
  private progressHandler = (event:ProgressEvent) => {
    // 改变状态
    this.status = STATUS.PROGRESS
    // 获取当前已上传字节数和总字节数
    this.loaded = event.loaded
    this.total = event.total
    // 触发文件块上传事件
    this.trigger('onChunkProgress')
  }

  /**
   * 初始化Axios请求头参数
   */
  private initAxiosRequestConfig() {
    // 添加请求拦截器
    axios.interceptors.request.use((config) => {
      // 请求头数据
      Object.entries(this.uploaderOption.headers).forEach(([k, v]) => {
        config.headers[k] = v
      })

      return config
    }, (error) => {
      // 对请求错误做些什么
      return Promise.reject(error)
    })
  }

  /**
   * 上传文件块数据
   */
  public uploadChunkData() {
    // 返回Promise
    return new Promise((resolve, reject) => {
      // 获取后端参数信息
      const query:Object = this.getParams()
      // 后端发送数据 使用FormData格式
      const data = new FormData()
      // 添加参数信息
      Object.entries(query).forEach(([k, v]) => {
        data.append(k, <string>v)
      })

      // 添加文件块参数
      data.append(this.uploaderOption.fileParameterName, this.bytes, this.fileParam.filename)
      // 上传服务器的文件路径
      const uploadFolderPath = this.uploaderOption.uploadFolderPath
      // 构建Axios请求
      this.initAxiosRequestConfig()
      // @ts-ignore
      axios({
        method: 'post',
        url: this.uploaderOption.uploadUrl,
        data: data,
        params: { uploadFolderPath },
        signal: this.controller.signal,
        // `onUploadProgress` 允许为上传处理进度事件
        // 浏览器专属
        onUploadProgress: (progressEvent:ProgressEvent) => {
          this.progressHandler(progressEvent)
        },
      }).then((result) => {
        if (this.uploaderOption.successCode.includes(result.data.code)) {
          // 改变状态
          this.status = STATUS.SUCCESS
          resolve(result)
        } else {
          // 改变状态
          this.status = STATUS.ERROR
          // 发送错误信息
          reject(new Error(result.data.code + ':' + result.data.message))
        }
      }).catch((error) => {
        // 改变状态
        this.status = STATUS.ERROR
        reject(error)
      })
    })
  }

  // 终止操作
  public cancelUploadChunk() {
    // 取消请求
    this.controller.abort()
  }
}
