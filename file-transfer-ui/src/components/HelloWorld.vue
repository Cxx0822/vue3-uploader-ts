<template>
  <div>
    <label class="uploader-btn" ref="btn">
      选择文件
    </label>

<!--    <table class="upload-file-list">-->
<!--      <caption>文件上传列表</caption>-->
<!--      <thead>-->
<!--        <tr>-->
<!--          <th></th>-->
<!--          <th>文件名称</th>-->
<!--          <th>文件大小</th>-->
<!--          <th>当前进度</th>-->
<!--          <th>上传速度</th>-->
<!--          <th>剩余时间</th>-->
<!--          <th>总时间</th>-->
<!--          <th>控制</th>-->
<!--        </tr>-->
<!--      </thead>-->

<!--      <tbody>-->
<!--        <tr v-for="(item, index) in uploaderInfo.uploadFileList" :key="index">-->
<!--          <td>-->
<!--            <button>选择</button>-->
<!--          </td>-->
<!--          <td>-->
<!--            <img src="../assets/vue.svg">-->
<!--            {{ item.name }}-->
<!--          </td>-->
<!--          <td>{{ item.size / 1000 }} kb</td>-->
<!--          <td>{{ item.currentProgress }} %</td>-->
<!--          <td>{{ item.currentSpeed }} kb/s</td>-->
<!--          <td>{{ item.timeRemaining }} s</td>-->
<!--          <td>{{  }} s</td>-->
<!--          <td>-->
<!--            <button>暂停</button>-->
<!--            <button>取消</button>-->
<!--          </td>-->
<!--        </tr>-->
<!--      </tbody>-->

<!--      <tfoot>-->
<!--        <tr>-->
<!--          <td colspan="8">总传输速度</td>-->
<!--        </tr>-->
<!--      </tfoot>-->
<!--    </table>-->

    <el-table
        :data="uploaderInfo.uploadFileList"
        :row-style="{height: '60px'}"
        border
        stripe
        style="width: 100%">
      <el-table-column type="selection" width="55" />

      <el-table-column label="文件名称" align="center" >
        <template #default="scope">
          <div>
            <font-awesome-icon :icon="getFileTypeIcon(scope.row.name)" size="2x"/>
            <span style="margin-left: 10px">{{ scope.row.name }}</span>
          </div>
        </template>
      </el-table-column>

      <el-table-column label="文件大小" align="center">
        <template #default="scope">
          <span>{{ formatFileSize(scope.row.size) }}</span>
        </template>
      </el-table-column>

      <el-table-column label="当前进度" align="center">
        <template #default="scope">
          <el-progress
              :text-inside="true"
              :stroke-width="24"
              :percentage="scope.row.currentProgress"
              status="success"
          />
        </template>
      </el-table-column>

      <el-table-column label="上传速度" align="center">
        <template #default="scope">
          <span>{{ formatSpeed(scope.row.currentSpeed)}}</span>
        </template>
      </el-table-column>

      <el-table-column label="剩余时间" align="center">
        <template #default="scope">
          <span>{{ formatMillisecond(scope.row.timeRemaining)}}</span>
        </template>
      </el-table-column>

      <el-table-column label="已用时" align="center" prop="currentProgress" />

      <el-table-column align="right">
        <template #default="scope">
          <el-button @click="handleEdit(scope.$index, scope.row)">Edit</el-button>
          <el-button type="danger" @click="handleDelete(scope.$index, scope.row)">Delete</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup lang="ts">
import { Uploader } from '../common/uploader'
import { onMounted, reactive, ref } from 'vue'
import { UploaderFileInfoIF, UploaderUserOptionsIF } from '../types'
import { UploadFile } from '../common/uploadFile'
import { faImage, faFilePdf, faFile } from '@fortawesome/free-solid-svg-icons'
import { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { formatFileSize, formatMillisecond, formatSpeed } from '../utils'
const btn = ref()

const handleEdit = (index: number, row: UploadFile) => {
  console.log(index, row)
}
const handleDelete = (index: number, row: UploadFile) => {
  console.log(index, row)
}

const options:UploaderUserOptionsIF = {
  chunkSize: 5 * 1024 * 1024,
  uploadUrl: 'http://192.168.5.80:8080/fileUpload/chunk',
  mergeUrl: 'http://192.168.5.80:8080/fileUpload/mergeFile',
  fileParameterName: 'multipartFile',
  uploadFolderPath: '/home/cxx/Downloads/uploadFiles',
  autoStart: true,
}

const uploaderInfo = reactive({
  uploadFileList: [] as UploaderFileInfoIF[],
})

const uploader = new Uploader(options)

onMounted(() => {
  uploader.assignBrowse(btn.value, false, false)
})

const getFileTypeIcon = (fileName:string) => {
  const reg = /\.[^.]+$/
  const fileType = reg.exec(fileName)?.[0].toLowerCase().slice(1)

  let fileTypeIcon: IconDefinition
  switch (fileType) {
    case 'img':
      fileTypeIcon = faImage
      break
    case 'pdf':
      fileTypeIcon = faFilePdf
      break
    default:
      fileTypeIcon = faFile
      break
  }
  return fileTypeIcon
}

const onFileSuccess = (uploadFile: UploadFile) => {
  console.log('上传成功')
}

const onFileFailed = (error:string) => {
  console.log('上传失败', error)
}

const onFileAdd = (uploadFile: UploadFile) => {
  uploaderInfo.uploadFileList.push(uploadFile)
}

const onUploaderProgress = (uploadFileInfo: UploaderFileInfoIF) => {
  const index = uploaderInfo.uploadFileList.findIndex((item) => {
    return item.uniqueIdentifier === uploadFileInfo.uniqueIdentifier
  })
  uploaderInfo.uploadFileList[index] = uploadFileInfo
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
