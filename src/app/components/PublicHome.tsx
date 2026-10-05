import Link from "next/link";
import PublicPage from "./PublicPage";

export default function PublicHome() {
  return (
    <PublicPage>
      <section className="card">
        <p className="eyebrow">Cùng đồng nghiệp chia sẻ chi phí</p>
        <h1>Chia tiền văn phòng</h1>
        <p>
          Ghi lại khoản bạn đã ứng, chia cho những người tham gia và theo dõi
          từng lần hoàn trả. Sử dụng trên máy tính và điện thoại qua trình
          duyệt.
        </p>
        <p>
          <Link href="/login">Đăng nhập hoặc tạo tài khoản →</Link>
        </p>
      </section>
      <section className="card">
        <h2>Từ hóa đơn đến xác nhận thanh toán</h2>
        <ul>
          <li>Tạo nhóm, mời đồng nghiệp và duyệt thành viên.</li>
          <li>Chia đều hoặc nhập phần riêng cho những người được chọn.</li>
          <li>Lưu thông tin chuyển khoản và QR ngân hàng.</li>
          <li>Báo đã chuyển tiền; người ứng tiền kiểm tra và xác nhận.</li>
          <li>Xem thống kê chi phí và các khoản còn cần hoàn trả.</li>
        </ul>
        <h2>Chụp và quét hóa đơn</h2>
        <p>
          Bạn có thể chọn ảnh hoặc chụp bằng điện thoại. Khi bấm quét, ảnh được
          gửi đến Groq để đọc số tiền, ngày và tên cửa hàng. Bạn kiểm tra kết
          quả trước khi lưu; nhập tay luôn là một lựa chọn.
        </p>
        <h2>Đăng nhập và dữ liệu</h2>
        <p>
          Đăng nhập bằng Google hoặc email và mật khẩu. Đăng nhập Google chỉ
          dùng thông tin nhận diện cơ bản, không yêu cầu quyền đọc Gmail, Drive
          hay danh bạ.
        </p>
        <p>
          Ứng dụng giúp ghi chép và đối chiếu khoản chia chung. Việc chuyển tiền
          được thực hiện qua ngân hàng của bạn.
        </p>
      </section>
    </PublicPage>
  );
}
