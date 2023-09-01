<template>
  <div>
    <el-button @click="download" id="download">下载</el-button>
  </div>
</template>

<script setup lang="ts">
import axios from 'axios'

const downloadFolderPath = 'D:\\temp\\downloads'
const fileName = 'burt-cut-fruit_1.1.0_amd64.zip'
let currentChunkIndex = 0
let percentage = '0'
const chunkList = [] // 文件流数组
const chunkSize = 1024 * 1024 * 1 // 单个分段大小，这里测试用100M
// 文件大小
let filesSize = 0
let totalChunkCount = 1 // 总共分几段下载

// 分段下载需要后端配合
const download = async () => {
  await getFileInfo()
    .then((response) => {
      filesSize = response.data.data.fileLength
      // 计算总共页数，向上取整
      totalChunkCount = Math.ceil(filesSize / chunkSize)

      // 第一次获取数据方便获取总数
      downloadChunk(currentChunkIndex)
    })
}
const downloadChunk = (chunkIndex) => {
  // const range = `${chunkIndex * chunkSize}-${(chunkIndex + 1) * chunkSize}`

  let range
  if (chunkIndex) {
    range = `${(chunkIndex - 1) * chunkSize + 2}-${chunkIndex * chunkSize + 1}`
  } else {
    // 第一次0-1方便获取总数，计算下载进度，每段下载字节范围区间
    range = '0-1'
  }

  const headers = {
    range: `bytes=${range}`
  }

  axios({
    url: 'http://127.0.0.1:8080/fileDownload/chunk',
    method: 'get',
    params: {
      downloadFolderPath,
      fileName
    },
    headers,
    responseType: 'blob'
  })
    .then((response) => {
      if (response.status === 200 || response.status === 206) {
        // 将下载的文件块添加至列表中
        const chunkData = response.data
        chunkList.push(chunkData)

        // 循环下载文件块
        if (currentChunkIndex < totalChunkCount) {
          currentChunkIndex++
          // 计算下载百分比  当前下载的片数/总片数
          percentage = Number((chunkList.length / totalChunkCount) * 100)
            .toFixed(2)
          console.log(percentage)
          downloadChunk(currentChunkIndex)

          return
        }

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
    })
    .catch((error) => {
      console.log(error)
    })
}

const getFileInfo = () => {
  return new Promise((resolve, reject) => {
    axios({
      url: 'http://127.0.0.1:8080/fileDownload/getFileInfo',
      method: 'get',
      params: {
        downloadFolderPath,
        fileName
      }
    })
      .then((response) => {
        resolve(response)
      })
      .catch((error) => {
        reject(error)
      })
  })
}
</script>

