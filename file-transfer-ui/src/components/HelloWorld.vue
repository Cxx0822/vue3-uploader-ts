<template>
  <div>
    <label class="uploader-btn" ref="btn">
      选择文件
    </label>

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
          <span>{{ formatSpeed(scope.row.currentSpeed) }}</span>
        </template>
      </el-table-column>

      <el-table-column label="剩余时间" align="center">
        <template #default="scope">
          <span>{{ formatMillisecond(scope.row.timeRemaining) }}</span>
        </template>
      </el-table-column>

      <el-table-column label="当前状态" align="center">
        <template #default="scope">
          <span>{{ scope.row.state + " " + scope.row.message }}</span>
        </template>
      </el-table-column>

<!--      <el-table-column label="已用时" align="center" prop="currentProgress" />-->

      <el-table-column label="操作" align="center">
        <template #default="scope">
          <el-button type="primary" @click="handlePauseOrResumeUpload(scope.$index, scope.row)">
            {{ scope.row.isPause === true ? '继续' : '暂停' }}
          </el-button>
          <el-button type="danger" :disabled="!scope.row.isPause" @click="handleCancelUpload(scope.$index, scope.row)" >取消</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup lang="ts">
import { Uploader } from '../common/uploader'
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { UploaderFileInfoIF, UploaderUserOptionsIF } from '../types'
import { faImage, faFilePdf, faFile } from '@fortawesome/free-solid-svg-icons'
import { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { formatFileSize, formatMillisecond, formatSpeed } from '../utils'
const btn = ref()

const serviceIp = '192.168.5.80'

const options:UploaderUserOptionsIF = {
  chunkSize: 5 * 1024 * 1024,
  uploadUrl: 'http://' + serviceIp + ':8080/fileUpload/chunk',
  mergeUrl: 'http://' + serviceIp + ':8080/fileUpload/mergeFile',
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

  // 监听文件上传事件
  uploader.on('onFileSuccess', onFileSuccess)
  uploader.on('onFileFailed', onFileFailed)
  uploader.on('onFileAdd', onFileAdd)
  uploader.on('onUploaderProgress', onUploaderProgress)
})

onUnmounted(() => {
  // 取消监听文件上传事件
  uploader.off('onFileSuccess')
  uploader.off('onFileFailed')
  uploader.off('onFileAdd')
  uploader.off('onUploaderProgress')
})

/**
 * 获取文件图标
 * @param fileName 文件名
 */
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

// 添加文件事件
const onFileAdd = (uploadFileInfo: UploaderFileInfoIF) => {
  uploaderInfo.uploadFileList.push(uploadFileInfo)
}

// 上传成功事件
const onFileSuccess = (uploadFileInfo: UploaderFileInfoIF) => {
  updateUploader(uploadFileInfo)
}

// 上传中事件
const onUploaderProgress = (uploadFileInfo: UploaderFileInfoIF) => {
  updateUploader(uploadFileInfo)
}

// 上传失败事件
const onFileFailed = (uploadFileInfo: UploaderFileInfoIF) => {
  updateUploader(uploadFileInfo)
}

/**
 * 更新上传器信息
 * @param uploadFileInfo 上传文件信息
 */
const updateUploader = (uploadFileInfo: UploaderFileInfoIF) => {
  const index = uploaderInfo.uploadFileList.findIndex((item) => {
    return item.uniqueIdentifier === uploadFileInfo.uniqueIdentifier
  })
  uploaderInfo.uploadFileList[index] = uploadFileInfo
}

// 取消文件上传
const handleCancelUpload = (index: number, uploaderFileInfo: UploaderFileInfoIF) => {
  const uploaderInfoIndex = uploader.cancelUpload(uploaderFileInfo)
  uploaderInfo.uploadFileList.splice(uploaderInfoIndex, 1)
}

// 处理暂停或者取消文件上传
const handlePauseOrResumeUpload = (index: number, uploaderFileInfo: UploaderFileInfoIF) => {
  if (uploaderFileInfo.isPause) {
    uploaderInfo.uploadFileList[index].isPause = false
    uploader.resumeUpload(uploaderFileInfo)
  } else {
    uploaderInfo.uploadFileList[index].isPause = true
    uploader.pauseUpload(uploaderFileInfo)
  }
}
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
