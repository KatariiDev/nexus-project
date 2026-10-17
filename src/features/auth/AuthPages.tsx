export { LoginPage } from './LoginPage';
import { Navigate } from 'react-router-dom';

/**
 * Đã bỏ chức năng đăng ký tự do theo yêu cầu (chỉ dùng đăng nhập nội bộ qua Discord server hoặc tài khoản do Dev tạo).
 */
export function RegisterPage() {
  return <Navigate to="/login" replace />;
}

export { ForgotPasswordPage } from './ForgotPassword';
