import { FileParamIF, UploaderDefaultOptionsIF } from '../types'
import { MyEvent } from './myEvent'

export const enum STATUS {
  // 等待处理
  PENDING,
  // 正在读取文件
  READING,
  // 上传成功
  SUCCESS,
  // 上传出错
  ERROR,
  // 上传中
  PROGRESS,
  // 重新上传
  RETRY,
  // 暂停上传
  ABORT
}

/**
 * 上传块类 利用XMLHttpRequest发送网络请求
 * 利用状态机实现控制
 * 1. 根据文件计算需要上传的文件块
 * 2. 预处理文件
 * 3. 预处理XHR请求
 * 4. 发送数据
 * 5. 监听XHR事件
 */
export class Chunk extends MyEvent {
  // 文件
  private file:File
  // 下载器配置项
  private uploaderOption:UploaderDefaultOptionsIF
  // 文件参数
  private fileParam:FileParamIF
  // 第几个文件块
  private readonly offset:number
  // 文件块大小
  private readonly chunkSize:number
  // 起始字节
  private readonly startByte:number
  // 终止字节
  private readonly endByte:number
  // 文件字节
  private bytes:Blob
  // XMLHttpRequest对象
  public xhr:XMLHttpRequest | null
  // 当前状态
  public status:STATUS
  private loaded:number
  private total:number
  private startTime:number

  /**
   * 构造函数
   * @param file 文件
   * @param uploaderOption 下载器选项
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
    this.xhr = null
    this.status = STATUS.PENDING
    this.loaded = 0
    this.total = 0
    this.startTime = Date.now()
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
   * 预处理
   */
  public preprocess() {
    // 拿到uploader opts中的预处理方法和读文件方法
    const preprocess = this.uploaderOption.preprocess

    if (typeof preprocess === 'function') {
      preprocess(this)
    }

    this.readFile()
    this.sendData()
    this.trigger('onChunkUploadNext')
  }

  /**
   * 读取文件块
   */
  private readFile() {
    this.status = STATUS.READING
    this.bytes = this.file.slice(this.startByte, this.endByte, this.fileParam.fileType)
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
    // can't return only chunk.loaded value, because it is bigger than chunk size
    // 如果没有上传成功 则需要乘上当前进度系数
    if (this.status !== STATUS.SUCCESS) {
      size = this.chunkProgress() * size
    }
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
   * 传输中处理
   * @param event 传输中事件
   */
  private progressHandler = (event:ProgressEvent) => {
    this.status = STATUS.PROGRESS
    // 如果可以计算进度
    if (event.lengthComputable) {
      this.loaded = event.loaded
      this.total = event.total
      // const percentComplete = event.loaded / event.total
      this.trigger('onChunkProgress')
    }
  }

  // 传输完成
  private completeHandler = () => {
    this.status = STATUS.SUCCESS
    this.trigger('onChunkSuccess')
  }

  // 传输失败
  private failedHandler = () => {
    this.status = STATUS.ERROR
    this.trigger('onChunkError')
  }

  // 取消传输
  private abortHandler = () => {
    this.status = STATUS.ABORT
    this.trigger('onChunkAbort')
  }

  // 向后端发送数据
  private sendData() {
    this.xhr = new XMLHttpRequest()

    const data = this.prepareXhrRequest(this.uploaderOption.uploadMethod,
      this.uploaderOption.method, this.bytes)

    // 构造XMLHttpRequest
    this.xhr.upload.addEventListener('progress', this.progressHandler, false)
    this.xhr.addEventListener('load', this.completeHandler, false)
    this.xhr.addEventListener('error', this.failedHandler, false)
    this.xhr.addEventListener('abort', this.abortHandler, false)

    this.xhr.send(data)
    this.status = STATUS.PROGRESS
    this.startTime = Date.now()
  }

  /**
   * 预处理XHR请求
   * @param method 请求方法
   * @param paramsMethod 参数方法
   * @param blob Blob数据
   * @returns 请求数据
   */
  private prepareXhrRequest(method:string, paramsMethod:string, blob:Blob | null) {
    if (this.xhr === null) {
      return
    }

    // 获取后端参数信息
    const query:Object = this.getParams()

    // 目标url
    const target = <string>(this.uploaderOption.target)
    let data

    switch (method) {
      case 'POST':
        // 使用FormData格式
        data = new FormData()
        Object.entries(query).forEach(([k, v]) => {
          data.append(k, v)
        })

        if (blob !== null) {
          data.append(this.uploaderOption.fileParameterName, blob, this.fileParam.filename)
        }
        break
      default:
        console.log('不合法的请求参数')
        return
    }

    this.xhr.open(method, target, true)
    this.xhr.withCredentials = <boolean>(this.uploaderOption.withCredentials)

    // Add data from header options
    Object.entries(this.uploaderOption.headers).forEach(([k, v]) => {
      this.xhr?.setRequestHeader(k, <string>v)
    })

    return data
  }

  // 终止操作
  public abort() {
    this.xhr?.abort()
  }

  public resume() {

  }

  public retry() {

  }
}
