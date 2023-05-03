import { Chunk, STATUS } from './chunk'
import { Uploader } from './uploader'
import { UploadUtils } from './utils'

export class UploadFile {
  private uploader:Uploader
  private files:File[]
  private fileList
  public chunks:Chunk[]
  private errorFiles
  public file:File
  private isFolder:boolean
  private isRoot:boolean
  private id:number
  private path: string
  public name:string
  public relativePath:string
  public fileType:string
  private prevProgress
  public size:number
  private isPaused:boolean
  private isError:boolean
  private allError:boolean
  private isAborted:boolean
  private isCompleted:boolean
  private averageSpeed:number
  private currentSpeed:number
  private lastProgressCallback:number
  private prevUploadedSize:number
  private prevProgress:number
  public uniqueIdentifier

  constructor(uploader:Uploader, file:File) {
    this.uploader = uploader
    this.file = file

    this.id = UploadUtils.uid()

    this.fileType = this.file.type
    this.name = file.name
    this.size = file.size
    this.relativePath = file.webkitRelativePath || this.name

    this.isPaused = false
    this.isError = false
    this.allError = false
    this.isAborted = false
    this.isCompleted = false
    this.averageSpeed = 0
    this.currentSpeed = 0
    this.lastProgressCallback = Date.now()
    this.prevUploadedSize = 0
    this.prevProgress = 0

    this.parseFile()
    this.bootstrap()
  }

  private parseFile() {
    this.updateParentFileList()
  }

  private updateParentFileList() {
    this.uploader.fileList.push(this)
  }

  _eachAccess(fileFn:Function, chunkFn:Function) {
    if (this.isFolder) {
      this.files.forEach((f, i) => {
        fileFn()
      })
    } else {
      chunkFn()
    }
  }

  private bootstrap() {
    if (this.isFolder) return
    const opts = this.uploader.opts

    if (typeof opts.initFileFn === 'function') {
      opts.initFileFn(this, this)
    }

    this.abort(true)
    this.resetError()
    // Rebuild stack of chunks from file
    this.prevProgress = 0
    const round = opts.forceChunkSize ? Math.ceil : Math.floor
    const chunks = Math.max(round(this.size / opts.chunkSize), 1)
    // 切片操作
    for (let offset = 0; offset < chunks; offset++) {
      this.chunks.push(new Chunk(this.uploader, this, offset))
    }
  }

  private abort(reset:boolean) {
    if (this.aborted) {
      return
    }
    this.currentSpeed = 0
    this.averageSpeed = 0
    this.aborted = !reset
    const chunks = this.chunks
    if (reset) {
      this.chunks = []
    }

    const uploadingStatus = STATUS.UPLOADING
    chunks.forEach((chunk) => {
      if (chunk.status === uploadingStatus) {
        chunk.abort()
        this.uploader.uploadNextChunk()
      }
    })
  }

  private resetError() {
    this.isError = this.allError = false
  }

  /**
   * 计算已上传文件的大小
   * @returns 已上传文件大小
   */
  private sizeUploaded():number {
    let size = 0

    this.chunks.forEach((chunk:Chunk) => {
      size += chunk.sizeUploaded()
    })

    return size
  }

  private checkProgress() {
    return Date.now() - this.lastProgressCallback >= this.uploader.opts.progressCallbacksInterval
  }

  private triggerProgress() {
    this.measureSpeed()
    this.uploader._trigger('fileProgress', rootFile, this, chunk)
    this.lastProgressCallback = Date.now()
  }

  public chunkEvent(chunk:Chunk, evt:string, message:string | null) {
    const uploader = this.uploader
    const rootFile = this.getRoot()

    let timeDiff
    let progeressId

    switch (evt) {
      case STATUS.PROGRESS:
        if (this.checkProgress()) {
          this.triggerProgress()
        }
        break
      case STATUS.ERROR:
        this._error()
        this.abort(true)
        uploader._trigger('fileError', rootFile, this, message, chunk)
        break
      case STATUS.SUCCESS:
        this.updateUploadedChunks(message, chunk)
        if (this.error) {
          return
        }

        timeDiff = Date.now() - this.lastProgressCallback
        if (timeDiff < uploader.opts.progressCallbacksInterval) {
          progeressId = setTimeout(this.triggerProgress,
            uploader.opts.progressCallbacksInterval - timeDiff)
        }
        if (this.isComplete()) {
          clearTimeout(progeressId)
          this.triggerProgress()
          this.currentSpeed = 0
          this.averageSpeed = 0
          uploader._trigger('fileSuccess', rootFile, this, message, chunk)
          if (rootFile.isComplete()) {
            uploader._trigger('fileComplete', rootFile, this)
          }
        } else if (!progeressId) {
          this.triggerProgress()
        }
        break
      case STATUS.RETRY:
        uploader._trigger('fileRetry', rootFile, this, chunk)
        break
    }
  }

  private updateUploadedChunks(message, chunk) {
    const checkChunkUploaded = this.uploader.opts.checkChunkUploadedByResponse
    if (checkChunkUploaded) {
      const xhr = chunk.xhr
      this.chunks.forEach((_chunk) => {
        if (!_chunk.tested) {
          const uploaded = checkChunkUploaded.call(this, _chunk, message)
          if (_chunk === chunk && !uploaded) {
            // fix the first chunk xhr status
            // treated as success but checkChunkUploaded is false
            // so the current chunk should be uploaded again
            _chunk.xhr = null
          }
          if (uploaded) {
            // first success and other chunks are uploaded
            // then set xhr, so the uploaded chunks
            // will be treated as success too
            _chunk.xhr = xhr
          }
          _chunk.tested = true
        }
      })

      if (!this.firstResponse) {
        this.firstResponse = true
        this.uploader.upload(true)
      } else {
        this.uploader.uploadNextChunk()
      }
    } else {
      this.uploader.uploadNextChunk()
    }
  }

  _error() {
    this.error = this.allError = true
    let parent = this.parent
    while (parent && parent !== this.uploader) {
      parent._errorFiles.push(this)
      parent.error = true
      if (parent._errorFiles.length === parent.files.length) {
        parent.allError = true
      }
      parent = parent.parent
    }
  }

  /**
   * 判断文件是否上传完成
   * @returns 是否全部完成
   */
  isComplete():boolean {
    return this.chunks.every((chunk) => {
      return chunk.status === STATUS.SUCCESS
    })
  }

  /**
   * 判断文件是否正在上传
   * @returns 是否有文件块正在上传
   */
  isUploading():boolean {
    return this.chunks.some((Chunk) => {
      return Chunk.status === STATUS.PROGRESS
    })
  }

  /**
   * 恢复文件上传
   */
  resume() {
    // 如果没有出错 并且已经暂停
    if (!this.isError && this.isPaused) {
      this.isPaused = false
      this.chunks.forEach((chunk) => {
        if (chunk.status !== STATUS.SUCCESS) {
          chunk.resume()
        }
      })
    }
  }

  /**
   * 暂停文件上传
   */
  pause() {
    // 如果没有出错 并且没有暂停
    if (!this.isError && !this.isPaused) {
      this.isPaused = true
      this.chunks.forEach((chunk) => {
        if (chunk.status !== STATUS.SUCCESS) {
          chunk.abort()
        }
      })
    }
  }

  /**
   * 取消文件上传
   */
  cancel() {
    this.uploader.removeFile(this)
  }

  /**
   * 重新上传
   */
  retry() {
    // 如果没有出错 并且已经暂停
    if (!this.isError) {
      this.chunks.forEach((chunk) => {
        if (chunk.status !== STATUS.SUCCESS) {
          chunk.retry()
        }
      })
    }
  }

  /**
   * 获取文件上传进度
   * @returns 当前文件上传进度
   */
  progress():number {
    let filePorgress:number = 0

    this.chunks.forEach((chunk) => {
      filePorgress += chunk.progress()
    })

    return filePorgress
  }

  /**
   * 计算当前文件传输速度 单位kb/s
   * 计算方法：当前正在上传文件块的平均传输速度
   */
  private measureSpeed():number {
    let isUploadChunkCount = 0
    let fileSpeed = 0
    this.chunks.forEach((chunk) => {
      if (chunk.status === STATUS.PROGRESS) {
        isUploadChunkCount++
        fileSpeed += chunk.measureSpeed()
      }
    })

    return fileSpeed / isUploadChunkCount
  }

  /**
   * 计算剩余时间
   * 计算方法：总字节数-已上传字节数 / 当前字节上传速度
   */
  private timeRemaining() {
    return (this.size - this.sizeUploaded()) / this.measureSpeed()
  }
}