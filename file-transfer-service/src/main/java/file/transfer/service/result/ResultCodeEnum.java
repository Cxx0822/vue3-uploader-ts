package file.transfer.service.result;

import lombok.Getter;
import lombok.ToString;

/**
 * @author Cxx
 */

@Getter
@ToString
public enum ResultCodeEnum {

    SUCCESS(true, 20000,"成功"),
    UNKNOWN_REASON(false, 20001, "未知错误"),
    NullPointerException(false, 20001, "空对象错误"),
    SQLSyntaxErrorException(false, 20001, "SQL语法错误"),
    AlgorithmMismatchException(false, 20001, "token算法不一致错误"),
    TokenExpiredException(false, 50014, "token过期错误"),
    SignatureVerificationException(false, 20001, "签名认证错误"),
    JWTDecodeException(false, 20001, "JWT解析错误"),
    UnknownAccountException(false, 20001, "账号不存在"),
    IncorrectCredentialsException(false, 20001, "密码错误");

    private Boolean success;

    private Integer code;

    private String message;

    public Boolean getSuccess() {
        return success;
    }

    public void setSuccess(Boolean success) {
        this.success = success;
    }

    public Integer getCode() {
        return code;
    }

    public void setCode(Integer code) {
        this.code = code;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    ResultCodeEnum(Boolean success, Integer code, String message) {
        this.success = success;
        this.code = code;
        this.message = message;
    }
}
