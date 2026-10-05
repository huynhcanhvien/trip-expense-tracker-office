import Link from "next/link";
import type { ReactNode } from "react";

export const supportEmail = "huynhcanhvien@gmail.com";

export function PolicyLinks() {
  return (
    <nav className="public-links" aria-label="Thông tin ứng dụng">
      <Link href="/">Giới thiệu</Link>
      <Link href="/privacy">Quyền riêng tư</Link>
      <Link href="/terms">Điều khoản</Link>
      <a href={`mailto:${supportEmail}`}>Liên hệ hỗ trợ</a>
    </nav>
  );
}

export default function PublicPage({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="office-header">
        <Link className="brand" href="/">
          Chia tiền <span>văn phòng</span>
        </Link>
        <Link href="/login">Đăng nhập / Đăng ký</Link>
      </header>
      <main className="office-page public-content">{children}</main>
      <footer className="office-footer">
        <PolicyLinks />
      </footer>
    </>
  );
}
