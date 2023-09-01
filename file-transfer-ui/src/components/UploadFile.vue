<template>
  <div class="uploader-file-container">
    <el-form :inline="true" :model="uploaderInfo" class="demo-form-inline">
      <el-form-item label="服务器地址">
        <el-input v-model="uploaderInfo.serviceIp"/>
      </el-form-item>

      <el-form-item label="上传文件夹路径">
        <el-input v-model="uploaderInfo.uploadFolderPath" style="width: 300px"/>
      </el-form-item>
    </el-form>

    <label class="uploader-btn" ref="selectFileBtn">
      <el-icon class="el-icon--upload">
        <upload-filled/>
      </el-icon>
    </label>

    <el-table
        :data="uploaderInfo.uploadFileList"
        :row-style="{height: '60px'}"
        border
        stripe
        style="width: 100%">
      <el-table-column type="selection" width="55"/>

      <el-table-column label="文件名称" align="center">
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
          <el-text>{{ formatSpeed(scope.row.currentSpeed) }}</el-text>
        </template>
      </el-table-column>

      <el-table-column label="剩余时间" align="center">
        <template #default="scope">
          <el-text>{{ formatMillisecond(scope.row.timeRemaining) }}</el-text>
        </template>
      </el-table-column>

      <el-table-column label="当前状态" align="center">
        <template #default="scope">
          <el-text>{{ scope.row.message }}</el-text>
        </template>
      </el-table-column>

      <el-table-column label="操作" align="center">
        <template #default="scope">
          <el-button type="primary"
                     :disabled="scope.row.state === STATUS.ERROR"
                     @click="handlePauseOrResumeUpload(scope.$index, scope.row)">
            {{ scope.row.state === STATUS.PROGRESS ? '暂停' : '继续' }}
          </el-button>
          <el-button type="danger"
                     :disabled="scope.row.state === STATUS.PROGRESS"
                     @click="handleCancelUpload(scope.$index, scope.row)">取消
          </el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup lang="ts">
import { Uploader } from '@/common/uploader'
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { IUploaderFileInfo, IUploaderUserOptions, STATUS } from '@/types'
import { formatFileSize, formatMillisecond, formatSpeed, getFileTypeIcon } from '@/utils'
import { UploadFilled } from '@element-plus/icons-vue'

// 选择文件按钮
const selectFileBtn = ref()

// 上传器信息
const uploaderInfo = reactive({
  serviceIp: 'http://192.168.5.90:8080',
  uploadFileList: [] as IUploaderFileInfo[],
  uploadFolderPath: '/home/frank/Downloads/temp'
})

// 上传器选项
const options: IUploaderUserOptions = {
  isAutoStart: true,
  fileTypeLimit: ['deb', 'pdf', 'txt', 'log', 'zip'],
  serviceIp: uploaderInfo.serviceIp,
  uploadUrl: '/fileUpload/chunk',
  mergeUrl: '/fileUpload/mergeFile',
  fileParameterName: 'multipartFile',
  uploadFolderPath: uploaderInfo.uploadFolderPath
}

// 实例化上传器类
const uploader = new Uploader(options)

onMounted(() => {
  // 激活上传文件按钮
  uploader.assignBrowse(selectFileBtn.value, false, false)

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

// 添加文件事件
const onFileAdd = (uploadFileInfo: IUploaderFileInfo) => {
  uploaderInfo.uploadFileList.push(uploadFileInfo)
}

// 上传成功事件
const onFileSuccess = (uploadFileInfo: IUploaderFileInfo) => {
  updateUploader(uploadFileInfo)
}

// 上传中事件
const onUploaderProgress = (uploadFileInfo: IUploaderFileInfo) => {
  updateUploader(uploadFileInfo)
}

// 上传失败事件
const onFileFailed = (uploadFileInfo: IUploaderFileInfo) => {
  updateUploader(uploadFileInfo)
}

/**
 * 更新上传器信息
 * @param uploadFileInfo 上传文件信息
 */
const updateUploader = (uploadFileInfo: IUploaderFileInfo) => {
  // 更新正在上传的文件状态
  uploaderInfo.uploadFileList[getUploadFileIndex(uploadFileInfo)] = uploadFileInfo
}

/**
 * 查找上传文件的索引
 * @param uploadFileInfo 上传文件
 */
const getUploadFileIndex = (uploadFileInfo: IUploaderFileInfo) => {
  // 找到正在上传的文件在文件列表中的索引
  return uploaderInfo.uploadFileList.findIndex((item) => {
    return item.uniqueIdentifier === uploadFileInfo.uniqueIdentifier
  })
}

/**
 * 取消文件上传
 * @param index 索引
 * @param uploaderFileInfo 上传文件
 */
const handleCancelUpload = (index: number, uploaderFileInfo: IUploaderFileInfo) => {
  // 当文件块处于暂停状态时 取消上传
  if (uploaderFileInfo.state === STATUS.ABORT) {
    uploader.cancelUpload(uploaderFileInfo)
  }
  uploader.deleteUploadFile(uploaderFileInfo)
  uploaderInfo.uploadFileList.splice(getUploadFileIndex(uploaderFileInfo), 1)
}

/**
 * 处理暂停或者取消文件上传
 * @param index 索引
 * @param uploaderFileInfo 上传文件
 */
const handlePauseOrResumeUpload = (index: number, uploaderFileInfo: IUploaderFileInfo) => {
  if (uploaderFileInfo.state === STATUS.ABORT) {
    uploaderInfo.uploadFileList[index].state = STATUS.PROGRESS
    uploader.resumeUpload(uploaderFileInfo)
  } else {
    uploaderInfo.uploadFileList[index].state = STATUS.ABORT
    uploader.pauseUpload(uploaderFileInfo)
  }
}
</script>

<style lang="scss" scoped>
.uploader-btn {
  font-size: 40px;

  .el-icon {
    color: #000000;
  }

  // border-style:solid;
  // border-width:2px;
  // border-color: #000000;
}

table {
  width: 100%;
  border-collapse: collapse;
}

table caption {
  border: 2px solid #999;
  font-size: 24px;
  font-weight: bold;
}

th, td {
  border: 2px solid #999;
  font-size: 18px;
  text-align: center;
}

table thead tr {
  background-color: #008c8c;
  color: #fff;
}

table tbody tr:nth-child(odd) {
  background-color: #eee;
}

table tbody tr:hover {
  background-color: #ccc;
}

table tbody tr td:first-child {
  color: #f40;
}

table tfoot tr td {
  text-align: right;
  padding-right: 20px;
}
</style>
