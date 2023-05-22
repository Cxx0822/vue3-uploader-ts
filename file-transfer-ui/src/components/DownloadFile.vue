<template>
  <div>
    <el-button @click="download" id="download">下载</el-button>
  </div>
</template>

<script setup lang="ts">
import axios from 'axios'

const downloadFolderPath = 'D:\\temp\\downloads'
const fileName = 'burt-therapist-ui_1.2.04_amd64.deb' // 搜索关键字
let filesCurrentPage = 0// 文件开始偏移量
let fileFinalOffset = 0 // 文件最后偏移量
let percentage
const stopRecursiveTags = true // 停止递归标签，默认是true 继续进行递归
const contentList = [] // 文件流数组
const breakpointResumeTags = false // 断点续传标签，默认是false 不进行断点续传

// 分段下载需要后端配合
const download = () => {
  const chunkSize = 1024 * 1024 * 1 // 单个分段大小，这里测试用100M
  let filesTotalSize // 安装包总大小，默认100M
  let filesPages = 1 // 总共分几段下载

  const sentAxios = (num) => {
    let range

    // 判断是否开启了断点续传(断点续传没法并行-需要上次请求的结果作为参数)
    if (breakpointResumeTags) {
      range = `${Number(fileFinalOffset) + 1}-${num * chunkSize + 1}`
    } else {
      if (num) {
        range = `${(num - 1) * chunkSize + 2}-${num * chunkSize + 1}`
      } else {
        // 第一次0-1方便获取总数，计算下载进度，每段下载字节范围区间
        range = '0-1'
      }
    }

    const headers = {
      range: range,
    }

    axios({
      url: 'http://127.0.0.1:8080/fileDownload/down',
      method: 'get',
      params: { downloadFolderPath, fileName },
      headers: headers,
      responseType: 'blob',
    })
      .then((response) => {
        if (response.status === 200 || response.status === 206) {
          // 检查了下才发现，后端对文件流做了一层封装，所以将content指向response.data即可
          const content = response.data
          // 截取文件总长度和最后偏移量
          console.log(response.headers['content-range'])
          const result = response.headers['content-range'].replace('bytes', '').split('/')
          // 获取文件总大小，方便计算下载百分比
          filesTotalSize = result[1]
          // 获取最后一片文件位置，用于断点续传
          fileFinalOffset = result[0].split('-')[1]
          // 计算总共页数，向上取整
          filesPages = Math.ceil(filesTotalSize / chunkSize)
          // 文件流数组
          contentList.push(content)
          // 递归获取文件数据(判断是否要继续递归)
          if (filesCurrentPage < filesPages && stopRecursiveTags) {
            filesCurrentPage++
            // 计算下载百分比  当前下载的片数/总片数
            percentage = Number((contentList.length / filesPages) * 100).toFixed(2)
            console.log(percentage)
            sentAxios(filesCurrentPage)
            // 结束递归
            return
          }

          // 递归标签为true 才进行下载
          if (stopRecursiveTags) {
            // 文件名称
            console.log(response)
            // const fileName = decodeURIComponent(response.headers['filename'])
            console.log(fileName)
            // 构造一个blob对象来处理数据
            const blob = new Blob(contentList)
            // IE10以上支持blob但是依然不支持download
            if ('download' in document.createElement('a')) {
              // 支持a标签download的浏览器
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
        } else {
          // 调用暂停方法，记录当前下载位置
          console.log('下载失败')
        }
      })
      .catch((error) => {
        console.log(error)
      })
  }

  // 第一次获取数据方便获取总数
  sentAxios(filesCurrentPage)
}
</script>

