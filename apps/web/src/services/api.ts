// Cấu hình URL Backend API
const API_BASE_URL = "http://localhost:5000/api";

// Hàm gọi API dùng chung
export async function apiRequest<T = any>(
    endpoint: string,
    options: RequestInit = {}
): Promise<{ success: boolean; data?: T; message?: string }> {
    const token = localStorage.getItem("aita_token");

    const headers: Record<string, string> = {
        ...(options.headers as Record<string, string>),
    };

    // Nếu body không phải là FormData (file upload) thì thêm Content-Type JSON
    if (!(options.body instanceof FormData)) {
        headers["Content-Type"] = "application/json";
    }

    // Tự động gắn Token nếu đã đăng nhập
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers,
        });

        const data = await response.json();

        // Nếu token hết hạn hoặc không hợp lệ -> tự động xóa và đẩy về Login
        if (response.status === 401) {
            localStorage.removeItem("aita_token");
            localStorage.removeItem("aita_user");
            if (window.location.pathname !== "/") {
                window.location.href = "/";
            }
        }

        if (!response.ok) {
            return {
                success: false,
                message: data.message || "Đã có lỗi xảy ra từ máy chủ.",
            };
        }

        return data;
    } catch (error: any) {
        console.error("Lỗi kết nối API:", error);
        return {
            success: false,
            message: "Không thể kết nối tới máy chủ Backend (Port 5000).",
        };
    }
}
