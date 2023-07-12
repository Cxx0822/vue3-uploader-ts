<template>
  <div class="app-container">
    <h2>文件传输系统</h2>
    <el-row :gutter="20">
      <el-col :span="12">
        <el-card shadow="always">
          <h3>上传文件模块</h3>
          <upload-file />
        </el-card>
      </el-col>
      <el-col :span="12">
        <div class="grid-content ep-bg-purple" />
      </el-col>
    </el-row>
  </div>

<!--  <download-file/>-->
</template>

<script setup lang="ts">
import UploadFile from './components/UploadFile.vue'
import DownloadFile from './components/DownloadFile.vue'
</script>

<style lang="scss" scoped>
.app-container {
  h3, h2 {
    text-align: center;
  }
}
</style>
