package file.transfer.service.entity.upload;

import lombok.Data;

import java.util.List;

/**
 * @author Cxx
 */
@Data
public class ChunkResult {
    //是否跳过上传（已上传的可以直接跳过，达到秒传的效果）
    private boolean isSkipUpload;

    //已经上传的文件块编号，可以跳过，断点续传
    private List<Integer> uploadedChunkList;
}