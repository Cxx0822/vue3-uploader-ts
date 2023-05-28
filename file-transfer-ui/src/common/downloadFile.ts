import axios from 'axios'
import { DownloaderDefaultOptionsIF } from '../types'

export class DownloadFile {
  // 下载器配置项
  private readonly downloadOption:DownloaderDefaultOptionsIF
  private chunkList:Blob[]
  private currentChunkIndex:number
  private totalChunkCount:number
  private currentProgress:number

  constructor(downloadOption:DownloaderDefaultOptionsIF) {
    this.downloadOption = downloadOption

    this.chunkList = []
    this.currentChunkIndex = 0
    this.totalChunkCount = 0
    this.currentProgress = 0
  }

  getDownloadFileInfo() {
    return new Promise((resolve, reject) => {
      const downloadFolderPath = this.downloadOption.downloadFolderPath
      const fileName = this.downloadOption.fileName
      axios({
        // url: 'http://127.0.0.1:8080/fileDownload/getFileInfo',
        url: this.downloadOption.getFileInfoUrl,
        method: 'get',
        params: { downloadFolderPath, fileName },
      }).then((response) => {
        resolve(response)
      })
        .catch((error) => {
          reject(error)
        })
    })
  }

  startDownload() {
    this.getDownloadFileInfo().then((response:any) => {
      const filesSize = response.data.data.fileLength
      // 计算总共页数，向上取整
      this.totalChunkCount = Math.ceil(filesSize / this.downloadOption.chunkSize)

      // 第一次获取数据方便获取总数
      this.downloadChunk(this.currentChunkIndex)
    })
  }

  downloadChunk = (chunkIndex:number) => {
    const headers = this.getChunkRange(chunkIndex)
    const downloadFolderPath = this.downloadOption.downloadFolderPath
    const fileName = this.downloadOption.fileName
    // @ts-ignore
    axios({
      // url: 'http://127.0.0.1:8080/fileDownload/chunk',
      url: this.downloadOption.downloadChunkUrl,
      method: 'get',
      params: { downloadFolderPath, fileName },
      headers,
      responseType: 'blob',
    })
      .then((response) => {
        if (response.status === 200 || response.status === 206) {
          // 将下载的文件块添加至列表中
          const chunkData = response.data
          this.chunkList.push(chunkData)

          // 循环下载文件块
          if (this.currentChunkIndex < this.totalChunkCount) {
            this.currentChunkIndex++
            // 计算下载百分比  当前下载的片数/总片数
            this.currentProgress = Number((this.chunkList.length / this.totalChunkCount) * 100)
            console.log(this.currentProgress)
            this.downloadChunk(this.currentChunkIndex)

            return
          }

          this.downloadFileByBrowser(this.chunkList, fileName)
        }
      })
      .catch((error) => {
        console.log(error)
      })
  }

  getChunkRange(chunkIndex:number):Object {
    // const range = `${chunkIndex * chunkSize}-${(chunkIndex + 1) * chunkSize}`

    let range
    if (chunkIndex) {
      range = `${(chunkIndex - 1) * this.downloadOption.chunkSize + 2}-${chunkIndex * this.downloadOption.chunkSize + 1}`
    } else {
      // 第一次0-1方便获取总数，计算下载进度，每段下载字节范围区间
      range = '0-1'
    }

    return {
      range: 'bytes=' + range,
    }
  }

  downloadFileByBrowser(chunkList:Blob[], fileName:string) {
    // 创建Blob对象并下载文件
    const blob = new Blob(chunkList)
    const link = document.createElement('a') // 创建a标签
    link.download = fileName // a标签添加属性
    link.style.display = 'none'
    link.href = URL.createObjectURL(blob)
    document.body.appendChild(link)
    link.click() // 执行下载
    URL.revokeObjectURL(link.href) // 释放url
    document.body.removeChild(link) // 释放标签
  }
}
