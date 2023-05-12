package file.transfer.service.entity.upload;

import lombok.Data;
import org.springframework.web.multipart.MultipartFile;

@Data
public class ChunkInfo {
    private String id;
    // 当前文件块，从1开始
    private Integer chunkNumber;
    // 每块大小
    private Long chunkSize;
    // 当前分块大小
    private Long currentChunkSize;
    // 总大小
    private Long totalSize;
    // 文件标识
    private String identifier;
    // 文件名
    private String filename;
    // 相对路径
    private String relativePath;
    // 总块数
    private Integer totalChunks;
    // 文件类型
    private String type;
    // 块内容
    private transient MultipartFile multipartFile;
}
