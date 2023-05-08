<template>
  <div>
    <label class="uploader-btn" ref="btn">
      选择文件
    </label>

    <table class="upload-file-list">
      <caption>文件上传列表</caption>
      <thead>
        <tr>
          <th></th>
          <th>文件名称</th>
          <th>文件大小</th>
          <th>当前进度</th>
          <th>上传速度</th>
          <th>剩余时间</th>
          <th>总时间</th>
          <th>控制</th>
        </tr>
      </thead>

      <tbody>
        <tr v-for="(item, index) in uploaderInfo.uploadFileList" :key="index">
          <td>
            <button>选择</button>
          </td>
          <td>
            <img src="../assets/vue.svg">
            {{ item.name }}
          </td>
          <td>{{ item.size / 1000 }} kb</td>
          <td>{{ item.currentProgress }} %</td>
          <td>{{ item.currentSpeed }} kb/s</td>
          <td>{{ item.timeRemaining }} s</td>
          <td>{{  }} s</td>
          <td>
            <button>暂停</button>
            <button>取消</button>
          </td>
        </tr>
      </tbody>

      <tfoot>
        <tr>
          <td colspan="8">总传输速度</td>
        </tr>
      </tfoot>
    </table>
  </div>
</template>

<script setup lang="ts">
import { Uploader } from '../common/uploader'
import { getCurrentInstance, onMounted, reactive, ref } from 'vue'
import { UploaderUserOptionsIF } from '../types'
import { UploadFile } from '../common/uploadFile'
import { formatMillisecond } from '../utils'
import axios from 'axios'

const btn = ref()

const options:UploaderUserOptionsIF = {
  chunkSize: 1 * 1024 * 1024,
  targetUrl: 'http://192.168.5.80:8080/fileUpload/chunk',
  fileParameterName: 'multipartFile',
  uploadFolderPath: '/home/cxx/Downloads/uploadFiles',
}

// const uploaderInfo = reactive({
//   uploadFileList: [] as UploadFile[],
// })

const uploaderInfo = reactive({
  uploadFileList: [] as UploadFile[],
})

const uploader = new Uploader(options)

onMounted(() => {
  uploader.assignBrowse(btn.value, false, false)
})

const onFileSuccess = (uploadFile: UploadFile) => {
  const index = uploaderInfo.uploadFileList.findIndex((item) => {
    return item.uniqueIdentifier === uploadFile.uniqueIdentifier
  })

  const uploadFolderPath = options.uploadFolderPath
  axios({
    url: 'http://192.168.5.80:8080/fileUpload/mergeFile',
    method: 'post',
    data: uploadFile,
    params: { uploadFolderPath },
    responseType: 'blob',
  }).then((response) => {
    if (response.status === 200) {
      uploaderInfo.uploadFileList[index].currentProgress = 100

      console.log('合并操作成功')
    } else {
      console.log('合并操作未成功，结果码：' + response.status)
    }

    // 需要强制刷新？？
    instance?.proxy?.$forceUpdate()
  }).catch((error:Error) => {
    console.log('合并后捕获的未知异常：' + error)
  })
}

const onFileFailed = () => {
  console.log('上传失败')
}

const onFileAdd = (uploadFile: UploadFile) => {
  uploaderInfo.uploadFileList.push(uploadFile)
}

const instance = getCurrentInstance()

const onUploaderProgress = (uploadFile: UploadFile) => {
  const index = uploaderInfo.uploadFileList.findIndex((item) => {
    return item.uniqueIdentifier === uploadFile.uniqueIdentifier
  })
  uploaderInfo.uploadFileList[index] = uploadFile

  // 需要强制刷新？？
  instance?.proxy?.$forceUpdate()
}

uploader.on('onFileSuccess', onFileSuccess)
uploader.on('onFileFailed', onFileFailed)
uploader.on('onFileAdd', onFileAdd)
uploader.on('onUploaderProgress', onUploaderProgress)
</script>

<style scoped>
.uploader-btn {
  width: 100px;
  border-style:solid;
  border-width:2px;
  border-color: #000000;
}

table{
  width: 100%;
  border-collapse: collapse;
}

table caption{
  border: 2px solid #999;
  font-size: 24px;
  font-weight: bold;
}

th,td{
  border: 2px solid #999;
  font-size: 18px;
  text-align: center;
}

table thead tr{
  background-color: #008c8c;
  color: #fff;
}

table tbody tr:nth-child(odd){
  background-color: #eee;
}

table tbody tr:hover{
  background-color: #ccc;
}

table tbody tr td:first-child{
  color: #f40;
}

table tfoot tr td{
  text-align: right;
  padding-right: 20px;
}
</style>
