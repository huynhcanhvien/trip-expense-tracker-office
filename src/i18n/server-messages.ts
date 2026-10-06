/** Vietnamese messages are kept as server-side keys to preserve API contracts. */
const english: Record<string, string> = {
  "Có yêu cầu tham gia nhóm mới": "A new request to join your group",
  "Yêu cầu tham gia đã được duyệt": "Your join request was approved",
  "Yêu cầu tham gia đã bị từ chối": "Your join request was rejected",
  "Bạn có khoản chia tiền mới": "You have a new expense share",
  "Khoản chia tiền đã được cập nhật": "An expense share was updated",
  "Thành viên đã báo chuyển tiền": "A member reported a transfer",
  "Khoản chuyển tiền đã được xác nhận": "A transfer was confirmed",
  "Khoản chuyển tiền chưa được xác nhận": "A transfer has not been confirmed",
  "Khoản chi đã bị hủy; kiểm tra đối soát":
    "An expense was cancelled; review reconciliation",
  "Vui lòng đăng nhập để tiếp tục.": "Please sign in to continue.",
  "Chỉ quản trị viên nhóm được thực hiện thao tác này.":
    "Only the group administrator can perform this action.",
  "Hãy nhập đúng tên nhóm để xác nhận xóa.":
    "Enter the exact group name to confirm deletion.",
  "Quản trị viên không thể rời nhóm. Bạn có thể xóa nhóm trong cài đặt.":
    "The administrator cannot leave the group. You can delete it in settings.",
  "Bạn cần thanh toán hết các khoản trong nhóm và được xác nhận đã nhận tiền trước khi rời nhóm.":
    "All your group payments must be received and confirmed before you can leave.",
  "Bạn cần nhận đủ và xác nhận các khoản người khác còn nợ bạn trong nhóm trước khi rời nhóm.":
    "Receive and confirm all amounts others owe you in this group before leaving.",
  "Hãy xác nhận bạn muốn rời nhóm.":
    "Confirm that you want to leave the group.",
  "Bạn chưa được duyệt vào nhóm này.":
    "Your membership in this group has not been approved.",
  "Link mời không còn hiệu lực. Hãy xin link mới.":
    "This invitation has expired. Please request a new link.",
  "Bạn đã là thành viên nhóm.": "You are already a member of this group.",
  "Số tiền không hợp lệ.": "Invalid amount.",
  "Hãy nhập số tiền dương với số chữ số thập phân phù hợp tiền tệ.":
    "Enter a positive amount with the decimal precision supported by this currency.",
  "Hãy chọn ít nhất một người cùng chia tiền.":
    "Select at least one person to split the expense with.",
  "Danh sách người chia bị trùng.":
    "The list of participants contains duplicates.",
  "Danh sách chỉ được gồm thành viên đã được duyệt.":
    "Only approved group members can participate.",
  "Số tiền từng người phải là số không âm.":
    "Each person's share must be zero or greater.",
  "Số tiền từng người không đúng độ chính xác của tiền tệ.":
    "A share has more decimal places than this currency supports.",
  "Tổng số tiền từng người phải bằng tổng expense.":
    "The shares must add up to the total expense.",
  "Chỉ người ứng tiền được sửa expense hoặc xác nhận thanh toán.":
    "Only the person who paid can edit this expense or confirm repayments.",
  "Đã có người báo chuyển hoặc expense đã hủy; không thể sửa phần chia.":
    "The shares cannot be edited after a transfer is reported or the expense is cancelled.",
  "Ảnh QR không hợp lệ hoặc chưa tải xong. Hãy chọn lại ảnh.":
    "The QR image is invalid or has not finished uploading. Please select it again.",
  "Ảnh hóa đơn không hợp lệ hoặc chưa tải xong. Hãy chọn lại ảnh.":
    "The receipt image is invalid or has not finished uploading. Please select it again.",
  "Ảnh hóa đơn này đã được dùng cho expense khác.":
    "This receipt image is already attached to another expense.",
  "Dữ liệu chưa hợp lệ. Hãy kiểm tra các trường bắt buộc và số tiền.":
    "Check the required fields and amounts.",
  "Không thể thực hiện thao tác. Vui lòng tải lại trang và thử lại.":
    "Unable to perform this action. Please reload the page and try again.",
  "Đã đổi tên nhóm.": "Group renamed.",
  "Đã tạo link mới. Link cũ đã bị thu hồi.":
    "A new invitation link has been created. The old link has been revoked.",
  "Đã gửi yêu cầu. Hãy chờ quản trị viên duyệt.":
    "Request sent. Please wait for the administrator's approval.",
  "Đã xử lý yêu cầu.": "Request processed.",
  "Hãy chọn người chia tiền.": "Select the participants.",
  "Đã cập nhật trạng thái thanh toán.": "Payment status updated.",
  "Đã hủy expense và giữ lịch sử đối soát.":
    "Expense cancelled. The reconciliation history has been preserved.",
  "Đã lưu tài khoản ngân hàng.": "Bank account saved.",
  "Đã lưu tên hiển thị.": "Display name saved.",
  "Không thể đánh dấu đã đọc.": "Unable to mark as read.",
  "Đã đánh dấu đã đọc.": "Marked as read.",
  "Chưa cấu hình Supabase. Điền các biến trong .env.example trước.":
    "Supabase is not configured. Fill in the variables in .env.example first.",
  "Nhập địa chỉ email hợp lệ.": "Enter a valid email address.",
  "Chưa gửi được email. Vui lòng thử lại sau.":
    "Unable to send the email. Please try again later.",
  "Nếu email đã đăng ký, bạn sẽ nhận được liên kết đặt lại mật khẩu.":
    "If this email is registered, you will receive a password reset link.",
  "Nhập email hợp lệ và mật khẩu từ 8 đến 128 ký tự.":
    "Enter a valid email address and a password of 8 to 128 characters.",
  "Tên hiển thị phải từ 1 đến 100 ký tự.":
    "Your display name must be 1 to 100 characters long.",
  "Không thể đăng ký. Kiểm tra thông tin hoặc thử lại sau.":
    "Unable to sign up. Check your details or try again later.",
  "Kiểm tra hộp thư để xác minh tài khoản, rồi đăng nhập.":
    "Check your inbox to verify your account, then sign in.",
  "Email hoặc mật khẩu chưa đúng, hoặc email chưa được xác minh.":
    "The email or password is incorrect, or the email has not been verified.",
  "Mật khẩu phải từ 8 đến 128 ký tự.":
    "Your password must be 8 to 128 characters long.",
  "Hai mật khẩu không khớp.": "The passwords do not match.",
  "Không thể đổi mật khẩu. Vui lòng yêu cầu liên kết mới.":
    "Unable to change your password. Please request a new link.",
  "Nhập số nguyên, không dùng dấu phân cách hàng nghìn.":
    "Enter a whole number without thousands separators.",
  "Tổng tiền phải lớn hơn 0.": "The total must be greater than 0.",
  "Số tiền không được vượt quá 1.000.000.000.000.":
    "The amount must not exceed 1,000,000,000,000.",
  "Bạn cần đăng nhập.": "You need to sign in.",
  "Yêu cầu quá lớn.": "The request is too large.",
  "Dữ liệu gửi lên không hợp lệ.": "Invalid request data.",
  "Không xử lý được yêu cầu. Vui lòng thử lại.":
    "Unable to process the request. Please try again.",
  "Nguồn yêu cầu không hợp lệ.": "Invalid request origin.",
  "Luồng chuyến đi công khai đã đóng. Hãy đăng nhập và quét hóa đơn trong nhóm.":
    "The public trip workflow is closed. Sign in to scan a receipt within a group.",
  "Không đọc được kết quả quét. Bạn có thể thử lại hoặc nhập tay.":
    "Unable to read the scan result. Try again or enter the details manually.",
  "Ảnh không hợp lệ. Hãy chọn ảnh JPEG, PNG hoặc WebP; chuyển HEIC sang JPEG trước khi tải.":
    "Invalid image. Select a JPEG, PNG or WebP image; convert HEIC to JPEG before uploading.",
  "Chức năng quét chưa được cấu hình. Bạn có thể nhập hóa đơn bằng tay.":
    "Receipt scanning is not configured. You can enter the receipt manually.",
  "Quét hóa đơn hết thời gian hoặc mất kết nối. Bạn có thể thử lại hoặc nhập tay.":
    "The receipt scan timed out or lost connection. Try again or enter the details manually.",
  "Dịch vụ quét đang bận. Vui lòng chờ rồi thử lại.":
    "The scanning service is busy. Please wait and try again.",
  "Dịch vụ quét tạm thời không khả dụng. Bạn có thể nhập tay.":
    "The scanning service is temporarily unavailable. You can enter the details manually.",
  "Thông tin ảnh không hợp lệ.": "Invalid image information.",
  "Bạn cần chọn nhóm cho hóa đơn.": "Select a group for this receipt.",
  "Không thể tải ảnh cho nhóm này.": "Unable to upload an image to this group.",
  "Không cấp được quyền tải ảnh. Vui lòng thử lại.":
    "Unable to authorize the upload. Please try again.",
  "Mã ảnh không hợp lệ.": "Invalid image ID.",
  "Không tìm thấy ảnh hoặc bạn không có quyền xem.":
    "Image not found or you do not have permission to view it.",
  "Không đọc được ảnh.": "Unable to load the image.",
  "Không tìm thấy ảnh của bạn.": "Your image was not found.",
  "Ảnh chưa tải xong. Vui lòng thử lại.":
    "The image has not finished uploading. Please try again.",
  "Ảnh vượt quá dung lượng cho phép.": "The image exceeds the allowed size.",
  "Không lưu được ảnh xem trước.": "Unable to save the preview image.",
  "Ảnh vừa được xử lý ở phiên khác hoặc đã hết hạn. Vui lòng thử lại.":
    "The image was processed in another session or has expired. Please try again.",
  "Không đọc được ảnh xem trước.": "Unable to load the preview image.",
  "Mã hóa đơn không hợp lệ.": "Invalid receipt ID.",
  "Ảnh hóa đơn chưa sẵn sàng hoặc bạn không có quyền quét.":
    "The receipt image is not ready or you do not have permission to scan it.",
  "Bạn đang quét một ảnh khác hoặc đã đạt giới hạn 10 lần/phút. Vui lòng chờ rồi thử lại.":
    "Another scan is in progress or you have reached the limit of 10 scans per minute. Please wait and try again.",
  "Không đọc được ảnh hóa đơn.": "Unable to load the receipt image.",
  "Không chuyển được ảnh HEIC. Vui lòng chọn JPEG/PNG hoặc bật định dạng tương thích trên camera.":
    "Unable to convert the HEIC image. Select JPEG/PNG or enable the camera's compatible format.",
  "Hãy chọn ảnh JPEG, PNG, WebP hoặc HEIC.":
    "Select a JPEG, PNG, WebP or HEIC image.",
  "Không mở được ảnh. Vui lòng chọn ảnh khác.":
    "Unable to open the image. Please select another image.",
  "Ảnh quá lớn. Vui lòng chọn ảnh nhỏ hơn 50 megapixel.":
    "The image is too large. Select an image smaller than 50 megapixels.",
  "Trình duyệt không xử lý được ảnh. Vui lòng thử trình duyệt khác.":
    "Your browser cannot process this image. Please try another browser.",
  "Không xử lý được ảnh.": "Unable to process the image.",
  "Không tải được ảnh. Vui lòng thử lại.":
    "Unable to upload the image. Please try again.",
  "Tải ảnh bị gián đoạn. Kiểm tra kết nối rồi chọn lại ảnh.":
    "The upload was interrupted. Check your connection and select the image again.",
  "Không tải được ảnh.": "Unable to upload the image.",
  "Ảnh đã hết hạn hoặc không tải được. Vui lòng tải lại.":
    "The image has expired or could not be loaded. Please reload it.",
  "Không quét được hóa đơn.": "Unable to scan the receipt.",
  "Không quét được hóa đơn. Bạn có thể nhập tay.":
    "Unable to scan the receipt. You can enter the details manually.",
  "Không đọc rõ tổng tiền. Bạn có thể đổi ảnh hoặc nhập bằng tay.":
    "The total could not be read clearly. Select another image or enter it manually.",
  "Đã điền kết quả quét. Hãy kiểm tra số tiền, ngày và người chia trước khi lưu.":
    "Scan results filled in. Check the amount, date and participants before saving.",
  "Đang đọc hóa đơn…": "Reading receipt…",
  "Đang xử lý ảnh…": "Processing image…",
  "Đang tải ảnh…": "Uploading image…",
  "Đang kiểm tra ảnh…": "Checking image…",
  "Ảnh đã tải xong.": "Image uploaded.",
  "Liên kết đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng thử lại.":
    "This sign-in link is invalid or has expired. Please try again.",
  "Đã đổi mật khẩu. Đăng nhập lại để tiếp tục.":
    "Password changed. Sign in again to continue.",
};

export function localizeServerMessage(
  message: string | undefined | null,
  locale: string,
): string {
  if (!message) return "";
  if (locale !== "en") return message;
  if (Object.hasOwn(english, message)) return english[message];
  const decimal = message.match(
    /^Nhập số tiền với tối đa (\d+) chữ số thập phân; dùng dấu chấm, không dùng dấu phân cách hàng nghìn\.$/,
  );
  if (decimal)
    return `Enter an amount with at most ${decimal[1]} decimal places; use a decimal point and no thousands separators.`;
  const size = message.match(/^Hãy chọn ảnh không quá (\d+) MB\.$/);
  if (size) return `Select an image no larger than ${size[1]} MB.`;
  const range = message.match(
    /^Ảnh phải có dung lượng từ 1 byte đến (\d+) MB\.$/,
  );
  if (range) return `The image must be between 1 byte and ${range[1]} MB.`;
  const exceeded = message.match(/^Ảnh vượt quá (\d+) MB\.$/);
  if (exceeded) return `The image exceeds ${exceeded[1]} MB.`;
  return message;
}
