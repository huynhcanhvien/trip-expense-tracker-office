# Thử OCR hóa đơn thật — 2026-10-06

Groq live, model qwen/qwen3.8-27b, temperature 0, ảnh chuẩn hóa bằng cùng
normalizeOfficeImage của ứng dụng. Không tạo expense hay ghi database.
Chỉ có một hóa đơn mẫu, không đại diện độ chính xác tổng thể.

Ground truth đọc từ ảnh: 5 món 28.000 + 32.000 + 40.000 + 32.000 + 35.000 =
167.000 VND; VAT in trên hóa đơn 100% = 167.000; tổng thanh toán 334.000;
tiền khách trả 334.000, tiền thừa 0. Ngày 2022-02-01; tên quán bị che.
Số đúng chỉ dùng chấm kết quả, không đưa vào prompt.

| Phương án                              | Lượt trả kết quả         | Tổng AI đọc | Đúng tổng in trên ảnh     | Thời gian  |
| -------------------------------------- | ------------------------ | ----------- | ------------------------- | ---------- |
| Hàm production hiện tại                | 1 (và một lượt trước đó) | 167000      | 0/1 (lượt trước cũng sai) | 2,07s      |
| Prompt phân biệt nhãn tổng/cash/change | 1                        | 167,000     | 0/1                       | 1,69s      |
| Đọc subtotal/thuế/phí/tổng có nhãn     | 3                        | 167,000     | 0/3                       | 1,42–2,60s |
| Đọc từng món rồi đối chiếu tổng        | 3                        | 334,000     | 3/3                       | 2,74–2,93s |

Các lượt 429 không được tính là kết quả OCR; lần chạy tiếp giãn 35 giây/lượt.
Baseline dùng giới hạn output production 512 token; các phương án dùng 2048
để chứa bảng món. Báo cáo usage được lưu cùng kết quả, không khẳng định benchmark
chỉ khác prompt.

Phương án từng món đọc đúng 5 số tiền, tổng món, VAT và tổng thanh toán cả 3 lượt.
Tên một số món còn sai dấu. Các phương án mới đều trả địa chỉ Phan Văn Trị,
Gò Vấp, HCM vào merchant dù tên quán bị che, và tiền chứa dấu phẩy trái với
schema yêu cầu plain decimal. Vì vậy 3/3 đúng số tiền trên ảnh chưa phải 3/3
đạt schema/API ứng dụng. Hàm normalizeOfficeReceipt hiện tại sẽ từ chối số
có dấu phẩy; chưa thay OCR production từ kết quả này.

Đề xuất tiếp: schema món + các dòng tổng, kiểm tra bằng big.js, kiểm soát format
số và merchant bị che, hiển thị dữ liệu cho người dùng sửa. Cần bộ nhiều hóa đơn
có VAT/giảm giá/cash/change để kiểm tra trước phát hành.

Harness: scripts/ocr-compare/receipt-strategies.mts. Ví dụ chạy với key trong env:

    node --env-file=.env.production --import tsx scripts/ocr-compare/receipt-strategies.mts IMAGE_PATH REPORT_PATH

Ảnh và report chi tiết không đưa vào git. Report lượt thử nằm trong
/private/tmp/office-receipt-strategies-reviewed.json, có thể mất khi dọn temp.
