package file.transfer.service.controller;

import file.transfer.service.result.R;
import file.transfer.service.service.ChunkService;
import file.transfer.service.utils.FileUtil;
import io.swagger.annotations.ApiOperation;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.*;

@RestController
@RequestMapping("/fileDownload")
@Slf4j
public class FileDownloadController {
    @Autowired
    private ChunkService chunkService;

    @ApiOperation("获取下载文件信息")
    @GetMapping("/getFileInfo")
    public R getDownloadFileInfo(@RequestParam("downloadFolderPath") String downloadFolderPath,
                                 @RequestParam("fileName") String fileName) {

        // 获取文件路径
        String downloadFilePath = downloadFolderPath + File.separator + fileName;
        File downloadFile = new File(downloadFilePath);

        // 判断文件夹是否存在
        if (FileUtil.fileExists(downloadFilePath)) {
            return R.ok().data("fileLength", downloadFile.length());
        } else {
            return R.error().message("download file is not exist");
        }
    }

    @ApiOperation("下载文件块")
    @GetMapping("/chunk")
    public void downLoadChunk(@RequestParam String downloadFolderPath,
                              @RequestParam String fileName,
                              HttpServletRequest request,
                              HttpServletResponse response) {

        // 获取文件路径
        String downloadFilePath = downloadFolderPath + File.separator + fileName;
        File file = new File(downloadFilePath);
        if (!file.exists()) {
            log.error("File is not exist");
            return;
        }

        try {
            // 下载文件块
            chunkService.downloadChunk(file, request, response);
        } catch (IOException e) {
            log.error("download chunk error : " + e.getMessage());
            throw new RuntimeException(e);
        }
    }
}
