import { UploadUtils } from './utils'
import { Uploader } from './uploader'
import { UploadFile } from './file'

export const enum STATUS {
  // 等待处理
  PENDING = 'pending',
  // 正在读取文件
  READING = 'reading',

  // 上传成功
  SUCCESS = 'success',
  // 上传出错
  ERROR = 'error',
  // 上传中
  PROGRESS = 'progress',
  // 重新上传
  RETRY = 'retry'
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
export class Chunk {
  // 下载器
  private uploader:Uploader
  // 下载文件
  private file:UploadFile
  // 第几个文件块
  private offset:number
  // 文件块大小
  private chunkSize:number
  // 起始字节
  private startByte:number
  // 终止字节
  private endByte:number
  // 文件字节
  private bytes:Blob | null
  // XMLHttpRequest对象
  public xhr:XMLHttpRequest | null
  // 当前状态
  public status:STATUS
  private pendingRetry:boolean
  private loaded:number
  private total:number
  private startTime:number

  /**
   * 构造函数
   * @param uploader 下载器
   * @param file 下载文件
   * @param offset 第几文件块
   */
  constructor(uploader:Uploader, file:UploadFile, offset:number) {
    this.uploader = uploader
    this.file = file
    this.offset = offset

    this.chunkSize = this.uploader.opts.chunkSize
    this.startByte = this.computeStartByte()
    this.endByte = this.computeEndByte()
    this.xhr = null
    this.bytes = null
    this.status = STATUS.PENDING
    this.pendingRetry = false
    this.loaded = 0
    this.total = 0
    this.startTime = Date.now()
  }

  _event(evt:any, args:any) {
    args.unshift(this)
    this.file.chunkEvent.apply(this.file, args)
  }

  /**
   * 计算起始字节数
   * @returns 字节数
   */
  private computeStartByte():number {
    console.log('startByte: ', this.offset * this.chunkSize)
    return this.offset * this.chunkSize
  }

  /**
   * 计算终止字节数
   * @returns 字节数
   */
  private computeEndByte():number {
    let endByte = (this.offset + 1) * this.chunkSize

    if (endByte > this.file.size) {
      endByte = this.file.size
    }

    console.log('endByte: ', endByte)
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
      totalSize: this.file.size,
      identifier: this.file.uniqueIdentifier,
      filename: this.file.name,
      relativePath: this.file.relativePath,
      totalChunks: this.file.chunks.length,
    }
  }

  /**
   * 预处理
   */
  private preprocess() {
    // 拿到uploader opts中的预处理方法和读文件方法
    const preprocess = this.uploader.opts.preprocess

    if (typeof preprocess === 'function') {
      preprocess(this)
    }
  }

  /**
   * 读取文件块
   * @param fileObj 文件对象
   */
  private readFile(fileObj:UploadFile) {
    this.bytes = fileObj?.file.slice(this.startByte, this.endByte, fileObj.fileType)
  }

  /**
   * 获取当前进度
   * @returns 当前进度
   */
  public progress():number {
    let chunkProgess = 0
    switch (this.status) {
      // 上传成功则为1
      case STATUS.SUCCESS:
        chunkProgess = 1
        break
      // 正在上传中
      case STATUS.PROGRESS:
        chunkProgess = this.total > 0 ? this.loaded / this.total : 0
        break
      // 其余情况均为0
      default:
        chunkProgess = 0
        break
    }

    return chunkProgess
  }

  /**
   * 计算文件块上传速度
   * @returns 文件块上传速度
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
      size = this.progress() * size
    }
    return size
  }

  /**
   * 传输中处理
   * @param event 传输中事件
   */
  private progressHandler(event:ProgressEvent) {
    // 如果可以计算进度
    if (event.lengthComputable) {
      this.loaded = event.loaded
      this.total = event.total
      const percentComplete = event.loaded / event.total
      this._event(STATUS.PROGRESS, percentComplete)
    }
  }

  // 传输完成
  private completeHandler(event:Event) {

  }

  // 传输失败
  private failedHandler(event:Event) {

  }

  // 取消传输
  private canceledHandler(event:Event) {

  }

  private HandleChunkStatus() {
    switch (this.status) {
      case STATUS.SUCCESS:
        break
    }
  }

  // 向后端发送数据
  public sendData() {
    // Set up request and listen for event
    // 构造XMLHttpRequest
    this.xhr = new XMLHttpRequest()
    this.xhr.upload.addEventListener('progress', this.progressHandler, false)

    this.xhr.addEventListener('load', this.completeHandler, false)
    this.xhr.addEventListener('error', this.failedHandler, false)
    this.xhr.addEventListener('abort', this.canceledHandler, false)

    const data = this.prepareXhrRequest(this.uploader.opts.uploadMethod,
      this.uploader.opts.method, this.bytes)

    this.xhr.send(data)
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

    // Add data from the query options
    const query = this.getParams()

    // 目标url
    const target = this.uploader.opts.target
    let data:any

    if (method === 'GET' || paramsMethod === 'octet') {
      // Add data from the query options
      const params:any[] = []
      Object.entries(query).forEach(([k, v]) => {
        params.push([encodeURIComponent(k), encodeURIComponent(v)].join('='))
      })

      data = blob || null
    } else {
      // Add data from the query options
      data = new FormData()
      Object.entries(query).forEach(([k, v]) => {
        data.append(k, v)
      })

      if (typeof blob !== 'undefined') {
        data.append(this.uploader.opts.fileParameterName, blob, this.file.name)
      }
    }

    this.xhr.open(method, target, true)
    this.xhr.withCredentials = this.uploader.opts.withCredentials

    // Add data from header options
    Object.entries(this.uploader.opts.headers).forEach(([k, v]) => {
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
