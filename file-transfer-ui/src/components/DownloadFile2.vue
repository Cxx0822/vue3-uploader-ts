<template>
    <div class="main">
        <el-button type="primary" @click="downloadFile">Test</el-button>
    </div>
</template>

<script setup lang="ts">
import axios from 'axios'
import * as FileSaver from 'file-saver'

const downloadFolderPath = 'D:\\temp\\downloads'
// const fileName = 'burt-cut-fruit_1.1.0_amd64.zip'
const fileName = 'test.pdf'

let blobList = []
let fileSize = 0
let chunkTotal = 0
let chunkSize = 1024 * 1024 * 1

// 点击下载文件
const downloadFile = async() => {
  await getDownloadFileInfo().then((response) => {
    fileSize = response.data.data.fileLength
    chunkTotal = Math.ceil(fileSize / chunkSize)
    console.log('chunkTotal: ', chunkTotal)
    blobList = []
    downloadChunk(1)
  })
}

const getDownloadFileInfo = () => {
  return new Promise((resolve, reject) => {
    axios({
      url: 'http://127.0.0.1:8080/fileDownload/getFileInfo',
      method: 'get',
      params: { downloadFolderPath, fileName },
    }).then((response) => {
      resolve(response)
    }).catch((error) => {
      reject(error)
    })
  })
}

// 点击下载文件分片
const downloadChunk = (chunkIndex) => {
  if (chunkIndex <= chunkTotal) {
    if (chunkIndex * chunkSize >= fileSize) {
      chunkSize = fileSize - (chunkIndex - 1) * chunkSize
    }

    axios({
      url: 'http://127.0.0.1:8080/fileDownload/chunk',
      method: 'get',
      params: { downloadFolderPath, fileName, chunkSize, chunkIndex },
      responseType: 'blob',
    }).then((res) => {
      console.log(chunkIndex)
      // const blob = new Blob([res.data], { type: 'application/octet-stream' })
      blobList.push(res.data)

      const blob = new Blob([res.data], { type: 'application/octet-stream' })
      FileSaver.saveAs(blob, fileName + '-' + chunkIndex)

      if (chunkIndex === chunkTotal) {
        console.log('合并文件')
        // const resBlob = new Blob(blobList, {
        //   type: 'application/octet-stream',
        // })

        // const resBlob = new Blob(blobList)

        // const blob = new Blob(blobList, { type: 'application/octet-stream' })
        // FileSaver.saveAs(blob, fileName)

        // const url = URL.createObjectURL(resBlob) // 将获取的文件转化为blob格式
        // const a = document.createElement('a') // 此处向下是打开一个储存位置
        // a.style.display = 'none'
        // a.href = url
        // // 下面两行是自己项目需要的处理，总之就是得到下载的文件名（加后缀）即可
        //
        // a.setAttribute('download', fileName)
        // document.body.appendChild(a)
        // a.click() // 点击下载
        // document.body.removeChild(a) // 下载完成移除元素
        // URL.revokeObjectURL(url) // 释放掉blob对象
      }

      downloadChunk(chunkIndex + 1)
    })
  }
}
</script>

<style  scoped>
    .main {
        display: flex;
    }
    .fileList {
        width: 400px;
    }
    .downloadList {
        width: 450px;
    }
    .title {
        margin-top: 5px;
        margin-bottom: 5px;
    }
    .downloading {
        margin-top: 10px;
    }
    .downloading .fileName {
        margin-left: 76px;
        margin-right: 30px;
    }
    .downloading .fileSize {
        /* margin-left: 70px; */
        margin-right: 30px;
    }
    .downloading .progress {
        display: flex;
    }
    .progress .el-progress {
        /* font-size: 18px; */
        width: 310px;
    }
</style>

