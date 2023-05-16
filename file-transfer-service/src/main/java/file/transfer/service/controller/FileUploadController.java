package file.transfer.service.controller;

import file.transfer.service.entity.upload.ChunkInfo;
import file.transfer.service.entity.upload.ChunkResult;
import file.transfer.service.entity.upload.UploaderFileInfo;
import file.transfer.service.result.R;
import file.transfer.service.utils.UploadFileUtil;
import io.swagger.annotations.ApiOperation;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;

@RestController
@RequestMapping("/fileUpload")
@Slf4j
public class FileUploadController {
    @ApiOperation("上传文件块")
    @PostMapping("/chunk")
    public R uploadChunk(ChunkInfo chunkInfo,
                         String uploadFolderPath) {
        MultipartFile file = chunkInfo.getMultipartFile();
        // log.info("file originName: {}, chunkNumber: {}", file.getOriginalFilename(), chunkFileInfo.getChunkNumber());

        try {
            byte[] bytes = file.getBytes();
            Path path = Paths.get(UploadFileUtil.generatePath(uploadFolderPath, chunkInfo));
            //文件写入指定路径
            Files.write(path, bytes);

            return R.ok();

        } catch (IOException exception) {
            log.info("文件上传块失败: ", exception);
            return R.error().message("上传失败");
        }
    }

    @ApiOperation("验证当前文件块是否上传")
    @GetMapping("/chunk")
    public R checkChunk(@RequestParam String identifier,
                        @RequestParam String filename,
                        @RequestParam String uploadFolderPath) {
        ChunkResult chunkResult = new ChunkResult();
        List<Integer> uploadedChunkList = new ArrayList<>();

        String folder = uploadFolderPath + File.separator + identifier;
        String file = folder + File.separator + filename;

        // 判断文件夹是否存在
        if (UploadFileUtil.fileExists(folder)) {
            // 先判断整个文件是否已经上传过了，如果是，则告诉前端跳过上传，实现秒传
            if (UploadFileUtil.fileExists(file)) {
                chunkResult.setSkipUpload(true);
                chunkResult.setUploadedChunkList(uploadedChunkList);
                log.info("完整文件已存在，直接跳过上传，实现秒传");
            } else {
                chunkResult.setSkipUpload(false);
                // 获取已经上传的文件块
                chunkResult.setUploadedChunkList(UploadFileUtil.getUploadedChunkList(folder, filename));
            }
        } else {
            chunkResult.setSkipUpload(false);
            chunkResult.setUploadedChunkList(uploadedChunkList);
        }


        return R.ok().data("chunkResult", chunkResult);
    }

    @ApiOperation("删除当前已上传的文件块")
    @DeleteMapping("/chunk")
    public R deleteChunk(@RequestParam String identifier,
                        @RequestParam String uploadFolderPath) {
        String folder = uploadFolderPath + File.separator + identifier;

        // 判断文件夹是否存在
        if (UploadFileUtil.fileExists(folder)) {
            UploadFileUtil.deleteDirectory(folder);
        }

        return R.ok();
    }

    @PostMapping("/mergeFile")
    public R mergeFile(@RequestBody UploaderFileInfo uploaderFileInfo,
                       @RequestParam String uploadFolderPath) {
        log.info("开始合并文件: " + uploaderFileInfo.getName());
        //进行文件的合并操作
        String filename = uploaderFileInfo.getName();
        String file = uploadFolderPath + File.separator + uploaderFileInfo.getUniqueIdentifier() + File.separator + filename;
        String folder = uploadFolderPath + File.separator + uploaderFileInfo.getUniqueIdentifier();

        if (UploadFileUtil.merge(file, folder, filename)) {
            log.info("文件{}合并完成", uploaderFileInfo.getName());
            return R.ok();
        } else {
            log.info("文件{}合并失败", uploaderFileInfo.getName());
            return R.error().message("文件合并失败");
        }
    }
}
