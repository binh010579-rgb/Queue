import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  createOrder,
  getOrdersByPhone,
  isValidPhone,
  normalizePhone,
  processNextOrder,
  type Order,
  type OrderStatus,
} from "./api";

type Category = "Sữa rửa mặt" | "Toner" | "Serum" | "Kem dưỡng" | "Kem chống nắng";
type Page = "home" | "detail" | "cart" | "orders";

type Product = {
  id: number;
  name: string;
  category: Category;
  price: number;
  image: string;
  description: string;
  badge?: string;
};

type CartItem = Product & { quantity: number };

const products: Product[] = [
  {
    id: 1,
    name: "Sữa rửa mặt dịu nhẹ Pure Clean",
    category: "Sữa rửa mặt",
    price: 289000,
    image:
      "https://images.unsplash.com/photo-1748639320154-6ba118bccc74?auto=format&fit=crop&w=900&q=85",
    description:
      "Công thức làm sạch dịu nhẹ với amino acid, giúp loại bỏ bụi bẩn và dầu thừa mà vẫn duy trì độ ẩm tự nhiên cho làn da.",
    badge: "Bán chạy",
  },
  {
    id: 2,
    name: "Nước cân bằng Rose Balance",
    category: "Toner",
    price: 345000,
    image:
      "https://images.unsplash.com/photo-1670201202833-b0932731628f?auto=format&fit=crop&w=900&q=85",
    description:
      "Nước cân bằng chiết xuất hoa hồng làm dịu da tức thì, hỗ trợ se nhỏ lỗ chân lông và chuẩn bị da cho các bước dưỡng tiếp theo.",
  },
  {
    id: 3,
    name: "Tinh chất HA Plump & Glow",
    category: "Serum",
    price: 520000,
    image:
      "https://images.unsplash.com/photo-1741896135512-084b251887f7?auto=format&fit=crop&w=900&q=85",
    description:
      "Phức hợp Hyaluronic Acid đa tầng cấp ẩm sâu, giúp làn da căng mọng, mềm mại và rạng rỡ chỉ sau vài lần sử dụng.",
    badge: "Mới",
  },
  {
    id: 4,
    name: "Kem dưỡng phục hồi Barrier Plus",
    category: "Kem dưỡng",
    price: 465000,
    image:
      "https://images.unsplash.com/photo-1629732097571-b042b35aa3ed?auto=format&fit=crop&w=900&q=85",
    description:
      "Ceramide và peptide giúp củng cố hàng rào bảo vệ da, khóa ẩm bền bỉ và hỗ trợ phục hồi làn da nhạy cảm.",
  },
  {
    id: 5,
    name: "Kem chống nắng Airy Shield SPF50+",
    category: "Kem chống nắng",
    price: 390000,
    image:
      "https://images.unsplash.com/photo-1738721796993-5f42d9315689?auto=format&fit=crop&w=900&q=85",
    description:
      "Kết cấu mỏng nhẹ, không nâng tông, bảo vệ da toàn diện trước tia UVA/UVB và ánh sáng xanh suốt ngày dài.",
    badge: "-15%",
  },
  {
    id: 6,
    name: "Gel rửa mặt Matcha Fresh",
    category: "Sữa rửa mặt",
    price: 315000,
    image:
      "https://images.unsplash.com/photo-1597931752949-98c74b5b159f?auto=format&fit=crop&w=900&q=85",
    description:
      "Gel tạo bọt mịn với trà xanh và BHA nồng độ thấp, làm sạch lỗ chân lông, phù hợp với làn da hỗn hợp và da dầu.",
  },
  {
    id: 7,
    name: "Serum Vitamin C Bright Drop",
    category: "Serum",
    price: 595000,
    image:
      "https://images.unsplash.com/photo-1788905073183-e39738f51230?auto=format&fit=crop&w=900&q=85",
    description:
      "Vitamin C tinh khiết kết hợp Ferulic Acid làm đều màu da, cải thiện vùng da xỉn màu và tăng vẻ rạng rỡ tự nhiên.",
  },
  {
    id: 8,
    name: "Kem dưỡng Water Cream",
    category: "Kem dưỡng",
    price: 430000,
    image:
      "https://images.unsplash.com/photo-1629732047847-50219e9c5aef?auto=format&fit=crop&w=900&q=85",
    description:
      "Chất kem dạng nước tan nhanh trên da, cấp ẩm tức thì mà không gây bết dính, lý tưởng cho khí hậu nóng ẩm.",
  },
];

const categories: Category[] = ["Sữa rửa mặt", "Toner", "Serum", "Kem dưỡng", "Kem chống nắng"];

const formatPrice = (price: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(price);

function Icon({
  name,
  size = 20,
}: {
  name: "bag" | "receipt" | "search" | "arrow" | "plus" | "minus" | "trash" | "check" | "sparkle";
  size?: number;
}) {
  const paths = {
    bag: (
      <>
        <path d="M6 8h12l-1 12H7L6 8Z" />
        <path d="M9 9V6a3 3 0 0 1 6 0v3" />
      </>
    ),
    receipt: (
      <>
        <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" />
        <path d="M9 8h6M9 12h6M9 16h3" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    arrow: (
      <>
        <path d="m15 18-6-6 6-6" />
        <path d="M9 12h11" />
      </>
    ),
    plus: (
      <>
        <path d="M12 5v14M5 12h14" />
      </>
    ),
    minus: <path d="M5 12h14" />,
    trash: (
      <>
        <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    sparkle: (
      <>
        <path d="m12 3 1.4 4.6L18 9l-4.6 1.4L12 15l-1.4-4.6L6 9l4.6-1.4L12 3Z" />
        <path d="m18.5 15 .7 2.3 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7.7-2.3Z" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

export default function App() {
  const [page, setPage] = useState<Page>("home");
  const [selectedProduct, setSelectedProduct] = useState<Product>(products[0]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<Category | "Tất cả">("Tất cả");
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem("beautystore_cart");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem("beautystore_cart", JSON.stringify(cart));
  }, [cart]);
  const [detailQuantity, setDetailQuantity] = useState(1);
  const [toast, setToast] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [checkoutPhoneError, setCheckoutPhoneError] = useState("");
  const [checkoutError, setCheckoutError] = useState("");
  const [ordersPhone, setOrdersPhone] = useState(
    () => localStorage.getItem("beautystore_phone") ?? "",
  );
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersSearched, setOrdersSearched] = useState(false);
  const [ordersError, setOrdersError] = useState("");

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const filteredProducts = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("vi");
    return products.filter(
      (product) =>
        (category === "Tất cả" || product.category === category) &&
        product.name.toLocaleLowerCase("vi").includes(keyword),
    );
  }, [search, category]);

  const navigate = (nextPage: Page) => {
    setPage(nextPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  };

  const addToCart = (product: Product, quantity = 1) => {
    setCart((current) => {
      const existing = current.find((item) => item.id === product.id);
      if (existing) {
        return current.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + quantity } : item,
        );
      }
      return [...current, { ...product, quantity }];
    });
    showToast(`Đã thêm ${product.name} vào giỏ`);
  };

  const updateQuantity = (id: number, change: number) => {
    setCart((current) =>
      current
        .map((item) => ({
          ...item,
          quantity: item.id === id ? item.quantity + change : item.quantity,
        }))
        .filter((item) => item.quantity > 0),
    );
  };

  const openDetail = (product: Product) => {
    setSelectedProduct(product);
    setDetailQuantity(1);
    navigate("detail");
  };

  const scrollToProducts = () => {
    navigate("home");
    window.setTimeout(
      () => document.getElementById("products")?.scrollIntoView({ behavior: "smooth" }),
      50,
    );
  };

  const loadOrders = async (phone = ordersPhone) => {
    if (!isValidPhone(phone)) {
      setOrdersError("Số điện thoại gồm 10 chữ số, bắt đầu bằng 0.");
      setOrders([]);
      setOrdersSearched(false);
      return;
    }

    setOrdersLoading(true);
    setOrdersError("");
    try {
      const result = await getOrdersByPhone(phone);
      setOrders(result);
      setOrdersSearched(true);
    } catch (error) {
      setOrders([]);
      setOrdersSearched(false);
      setOrdersError(error instanceof Error ? error.message : "Không thể tải đơn hàng.");
    } finally {
      setOrdersLoading(false);
    }
  };

  const placeOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (cart.length === 0 || submittingRef.current) return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    const phone = String(formData.get("phone") ?? "");
    if (!isValidPhone(phone)) {
      setCheckoutPhoneError("Số điện thoại gồm 10 chữ số, bắt đầu bằng 0.");
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setCheckoutPhoneError("");
    setCheckoutError("");

    try {
      const result = await createOrder({
        customerName: String(formData.get("name") ?? ""),
        phone,
        address: String(formData.get("address") ?? ""),
        items: cart.map((item) => ({
          productId: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
        })),
        total: cartTotal,
      });
      const normalizedPhone = normalizePhone(phone);
      localStorage.setItem("beautystore_phone", normalizedPhone);
      setOrdersPhone(normalizedPhone);
      setCart([]);
      form.reset();
      showToast(`Đặt hàng thành công! Mã đơn #${result.orderId}`);
      navigate("orders");
      await loadOrders(normalizedPhone);
    } catch (error) {
      setCheckoutError(
        error instanceof Error ? error.message : "Không thể đặt hàng. Vui lòng thử lại.",
      );
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const statusDetails: Record<OrderStatus, { label: string; className: string }> = {
    PENDING: { label: "Chờ xử lý", className: "bg-[#fff3cd] text-[#8a6512]" },
    APPROVED: { label: "Đã duyệt", className: "bg-[#dff5e8] text-[#29704b]" },
    COMPLETED: { label: "Hoàn thành", className: "bg-[#dfeeff] text-[#28639b]" },
    CANCELLED: { label: "Đã hủy", className: "bg-[#f1e4e8] text-[#92566a]" },
  };

  return (
    <div className="min-h-screen bg-[#fff9fa] text-[#30292c]">
      <header className="sticky top-0 z-40 border-b border-[#f3e4e8] bg-[#fff9fa]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[76px] max-w-[1240px] items-center justify-between px-5 sm:px-8">
          <button
            onClick={() => navigate("home")}
            className="group flex items-center gap-2.5"
            aria-label="Về trang chủ"
          >
            <span className="grid h-9 w-9 place-items-center rounded-full bg-[#ff6b8b] text-white transition-transform group-hover:rotate-6">
              <Icon name="sparkle" size={19} />
            </span>
            <span className="font-serif text-xl font-semibold tracking-[-0.02em] sm:text-2xl">
              Beauty<span className="text-[#ff5e81]">Store</span>
            </span>
          </button>
          <nav className="hidden items-center gap-8 text-[14px] font-medium md:flex">
            <button
              onClick={() => navigate("home")}
              className={page === "home" ? "text-[#ff5e81]" : "hover:text-[#ff5e81]"}
            >
              Trang chủ
            </button>
            <button onClick={scrollToProducts} className="hover:text-[#ff5e81]">
              Sản phẩm
            </button>
          </nav>
        <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                try {
                  const res = await processNextOrder();
                  showToast(`Đã duyệt đơn #${res.orderId}`);
                  if (page === "orders" && isValidPhone(ordersPhone)) {
                    await loadOrders(ordersPhone);
                  }
                } catch (e) {
                  showToast(e instanceof Error ? e.message : "Hàng đợi đang rỗng");
                }
              }}
              className="flex items-center gap-2 rounded-full border border-[#eadadd] bg-white px-3 py-2.5 text-sm font-semibold text-[#29704b] shadow-[0_4px_20px_rgba(93,55,65,0.05)] transition hover:-translate-y-0.5 hover:border-[#29704b] sm:px-4"
            >
              <Icon name="check" size={18} />
              <span className="hidden sm:inline">Duyệt đơn</span>
            </button>
            <button
              onClick={() => navigate("orders")}
              className="flex items-center gap-2 rounded-full border border-[#eadadd] bg-white px-3 py-2.5 text-sm font-semibold shadow-[0_4px_20px_rgba(93,55,65,0.05)] transition hover:-translate-y-0.5 hover:border-[#ff9eb3] sm:px-4"
            >
              <Icon name="receipt" size={18} />
              <span className="hidden sm:inline">Đơn hàng</span>
            </button>
            <button
              onClick={() => navigate("cart")}
              className="relative flex items-center gap-2 rounded-full border border-[#eadadd] bg-white px-3 py-2.5 text-sm font-semibold shadow-[0_4px_20px_rgba(93,55,65,0.05)] transition hover:-translate-y-0.5 hover:border-[#ff9eb3] sm:px-4"
            >
              <Icon name="bag" size={19} />
              <span className="hidden sm:inline">Giỏ hàng</span>
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[#ff6b8b] px-1 text-[11px] text-white">
                {cartCount}
              </span>
            </button>
          </div>
        </div>
      </header>

      {page === "home" && (
        <main>
          <section className="mx-auto max-w-[1240px] px-5 pt-5 sm:px-8 sm:pt-8">
            <div className="relative min-h-[460px] overflow-hidden rounded-[32px] bg-[#f9dfe5] sm:min-h-[500px]">
              <img
                src="https://images.unsplash.com/photo-1653784097013-786a8965ea3b?auto=format&fit=crop&w=1600&q=90"
                alt="Bộ sưu tập mỹ phẩm cao cấp"
                className="absolute inset-0 h-full w-full object-cover object-center md:object-[65%_50%]"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-[#fff4f5] via-[#fff4f5]/85 to-transparent" />
              <div className="relative z-10 flex min-h-[460px] max-w-xl flex-col justify-center p-8 sm:min-h-[500px] sm:p-14 lg:p-20">
                <span className="mb-5 w-fit rounded-full border border-[#f3b6c2] bg-white/70 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#b83f5a] backdrop-blur">
                  Nâng niu vẻ đẹp thuần khiết
                </span>
                <h1 className="font-serif text-[44px] leading-[1.02] font-medium tracking-[-0.04em] text-[#392e32] sm:text-6xl">
                  Chạm đến làn da <span className="italic text-[#e95677]">rạng rỡ</span>
                </h1>
                <p className="mt-6 max-w-md text-[15px] leading-7 text-[#6c5e63] sm:text-base">
                  Khám phá những sản phẩm chăm sóc da được tuyển chọn để tôn vinh nét đẹp tự nhiên
                  của riêng bạn.
                </p>
                <button
                  onClick={scrollToProducts}
                  className="mt-8 w-fit rounded-full bg-[#30292c] px-7 py-3.5 text-sm font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-[#ff5e81]"
                >
                  Khám phá ngay
                </button>
              </div>
            </div>
          </section>

          <section id="products" className="mx-auto max-w-[1240px] px-5 py-20 sm:px-8">
            <div className="mb-9 flex flex-col justify-between gap-5 md:flex-row md:items-end">
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[#ff5e81]">
                  Chăm sóc mỗi ngày
                </p>
                <h2 className="font-serif text-3xl font-medium tracking-tight sm:text-4xl">
                  Sản phẩm nổi bật
                </h2>
              </div>
              <div className="relative w-full md:w-[350px]">
                <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-[#8c7a80]">
                  <Icon name="search" size={19} />
                </span>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Tìm kiếm sản phẩm..."
                  className="h-12 w-full rounded-full border border-[#eadde0] bg-white pr-5 pl-12 text-sm outline-none transition placeholder:text-[#a99da1] focus:border-[#ff8ca5] focus:ring-4 focus:ring-[#ff6b8b]/10"
                />
              </div>
            </div>

            <div className="no-scrollbar mb-10 flex gap-2.5 overflow-x-auto pb-2">
              {(["Tất cả", ...categories] as const).map((item) => (
                <button
                  key={item}
                  onClick={() => setCategory(item)}
                  className={`shrink-0 rounded-full px-5 py-2.5 text-sm font-medium transition ${
                    category === item
                      ? "bg-[#ff6b8b] text-white shadow-[0_6px_18px_rgba(255,107,139,0.25)]"
                      : "border border-[#eadde0] bg-white text-[#6d5c62] hover:border-[#ff9eb3]"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>

            {filteredProducts.length ? (
              <div className="grid grid-cols-1 gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
                {filteredProducts.map((product) => (
                  <article key={product.id} className="group">
                    <button
                      onClick={() => openDetail(product)}
                      className="relative block aspect-[4/4.6] w-full overflow-hidden rounded-[24px] bg-[#f4e9eb] text-left"
                    >
                      <img
                        src={product.image}
                        alt={product.name}
                        className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                      />
                      {product.badge && (
                        <span className="absolute top-4 left-4 rounded-full bg-white/90 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#d44b69] backdrop-blur">
                          {product.badge}
                        </span>
                      )}
                    </button>
                    <div className="pt-5">
                      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#b59ba2]">
                        {product.category}
                      </p>
                      <button
                        onClick={() => openDetail(product)}
                        className="min-h-12 text-left text-[16px] leading-6 font-semibold transition hover:text-[#ff5e81]"
                      >
                        {product.name}
                      </button>
                      <p className="mt-2 text-lg font-bold text-[#e84f70]">
                        {formatPrice(product.price)}
                      </p>
                      <div className="mt-4 grid grid-cols-[1fr_48px] gap-2">
                        <button
                          onClick={() => openDetail(product)}
                          className="rounded-full border border-[#e7d8dc] px-4 py-2.5 text-sm font-semibold transition hover:border-[#ff8ca5] hover:text-[#e84f70]"
                        >
                          Chi tiết
                        </button>
                        <button
                          onClick={() => addToCart(product)}
                          className="grid h-11 w-12 place-items-center rounded-full bg-[#30292c] text-white transition hover:-translate-y-0.5 hover:bg-[#ff5e81]"
                          aria-label={`Thêm ${product.name} vào giỏ`}
                        >
                          <Icon name="bag" size={18} />
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-[28px] border border-dashed border-[#e6cdd3] bg-white py-20 text-center">
                <p className="font-serif text-2xl">Không tìm thấy sản phẩm</p>
                <p className="mt-2 text-sm text-[#8a777d]">
                  Thử từ khóa khác hoặc chọn một danh mục mới.
                </p>
              </div>
            )}
          </section>
        </main>
      )}

      {page === "detail" && (
        <main className="mx-auto max-w-[1160px] px-5 py-10 sm:px-8 sm:py-16">
          <button
            onClick={() => navigate("home")}
            className="mb-8 flex items-center gap-2 text-sm font-semibold text-[#77666c] transition hover:text-[#ff5e81]"
          >
            <Icon name="arrow" size={18} /> Quay lại trang chủ
          </button>
          <div className="grid gap-10 lg:grid-cols-2 lg:gap-20">
            <div className="aspect-square overflow-hidden rounded-[32px] bg-[#f4e9eb]">
              <img
                src={selectedProduct.image}
                alt={selectedProduct.name}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="flex flex-col justify-center">
              <span className="mb-4 w-fit rounded-full bg-[#ffe5eb] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#c64562]">
                {selectedProduct.category}
              </span>
              <h1 className="font-serif text-4xl leading-tight font-medium tracking-[-0.03em] sm:text-5xl">
                {selectedProduct.name}
              </h1>
              <p className="mt-5 text-2xl font-bold text-[#e84f70]">
                {formatPrice(selectedProduct.price)}
              </p>
              <div className="my-8 h-px bg-[#eadde0]" />
              <p className="text-[15px] leading-7 text-[#716167]">{selectedProduct.description}</p>
              <ul className="mt-6 space-y-3 text-sm text-[#65575c]">
                {[
                  "Thành phần an toàn, lành tính",
                  "Phù hợp với mọi loại da",
                  "Sản phẩm chính hãng 100%",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-[#ffe1e8] text-[#e34f70]">
                      <Icon name="check" size={12} />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                <div className="flex h-14 items-center justify-between rounded-full border border-[#e5d6da] bg-white px-2 sm:w-36">
                  <button
                    onClick={() => setDetailQuantity((value) => Math.max(1, value - 1))}
                    className="grid h-10 w-10 place-items-center rounded-full transition hover:bg-[#fff0f3]"
                    aria-label="Giảm số lượng"
                  >
                    <Icon name="minus" size={16} />
                  </button>
                  <span className="font-semibold">{detailQuantity}</span>
                  <button
                    onClick={() => setDetailQuantity((value) => value + 1)}
                    className="grid h-10 w-10 place-items-center rounded-full transition hover:bg-[#fff0f3]"
                    aria-label="Tăng số lượng"
                  >
                    <Icon name="plus" size={16} />
                  </button>
                </div>
                <button
                  onClick={() => addToCart(selectedProduct, detailQuantity)}
                  className="flex h-14 flex-1 items-center justify-center gap-3 rounded-full bg-[#ff6b8b] px-8 font-semibold text-white shadow-[0_10px_28px_rgba(255,107,139,0.3)] transition hover:-translate-y-0.5 hover:bg-[#f45578]"
                >
                  <Icon name="bag" /> Thêm vào giỏ
                </button>
              </div>
            </div>
          </div>
        </main>
      )}

      {page === "cart" && (
        <main className="mx-auto max-w-[1200px] px-5 py-10 sm:px-8 sm:py-16">
          <button
            onClick={scrollToProducts}
            className="mb-8 flex items-center gap-2 text-sm font-semibold text-[#77666c] transition hover:text-[#ff5e81]"
          >
            <Icon name="arrow" size={18} /> Tiếp tục mua sắm
          </button>
          <div className="mb-10">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[#ff5e81]">
              Đơn hàng của bạn
            </p>
            <h1 className="font-serif text-4xl font-medium tracking-tight sm:text-5xl">Giỏ hàng</h1>
          </div>

          {cart.length === 0 ? (
            <div className="rounded-[32px] border border-[#eee0e3] bg-white px-6 py-20 text-center shadow-[0_12px_40px_rgba(83,49,58,0.04)]">
              <span className="mx-auto mb-6 grid h-20 w-20 place-items-center rounded-full bg-[#fff0f3] text-[#ff6b8b]">
                <Icon name="bag" size={32} />
              </span>
              <h2 className="font-serif text-3xl">Giỏ hàng đang trống</h2>
              <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#827177]">
                Có vẻ bạn chưa chọn sản phẩm nào. Hãy khám phá những sản phẩm chăm sóc da tuyệt vời
                của chúng tôi.
              </p>
              <button
                onClick={scrollToProducts}
                className="mt-7 rounded-full bg-[#30292c] px-7 py-3.5 text-sm font-semibold text-white transition hover:bg-[#ff5e81]"
              >
                Khám phá sản phẩm
              </button>
            </div>
          ) : (
            <div className="grid items-start gap-8 lg:grid-cols-[1.35fr_0.85fr]">
              <section className="space-y-4">
                {cart.map((item) => (
                  <article
                    key={item.id}
                    className="flex gap-4 rounded-[24px] border border-[#eee0e3] bg-white p-4 shadow-[0_8px_30px_rgba(83,49,58,0.04)] sm:gap-5 sm:p-5"
                  >
                    <img
                      src={item.image}
                      alt={item.name}
                      className="h-28 w-24 shrink-0 rounded-[16px] object-cover sm:h-32 sm:w-28"
                    />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#b59ba2]">
                        {item.category}
                      </p>
                      <h2 className="mt-1 line-clamp-2 text-sm font-semibold sm:text-base">
                        {item.name}
                      </h2>
                      <p className="mt-2 text-sm font-bold text-[#e84f70]">
                        {formatPrice(item.price)}
                      </p>
                      <div className="mt-auto flex items-end justify-between">
                        <div className="flex h-9 items-center rounded-full border border-[#eadde0]">
                          <button
                            onClick={() => updateQuantity(item.id, -1)}
                            className="grid h-9 w-9 place-items-center"
                            aria-label="Giảm số lượng"
                          >
                            <Icon name="minus" size={14} />
                          </button>
                          <span className="w-7 text-center text-sm font-semibold">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.id, 1)}
                            className="grid h-9 w-9 place-items-center"
                            aria-label="Tăng số lượng"
                          >
                            <Icon name="plus" size={14} />
                          </button>
                        </div>
                        <button
                          onClick={() =>
                            setCart((current) =>
                              current.filter((product) => product.id !== item.id),
                            )
                          }
                          className="flex items-center gap-1.5 text-xs font-semibold text-[#9b7f86] transition hover:text-[#e24869]"
                        >
                          <Icon name="trash" size={15} />{" "}
                          <span className="hidden sm:inline">Xóa</span>
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </section>

              <form
                onSubmit={placeOrder}
                className="rounded-[28px] border border-[#eee0e3] bg-white p-6 shadow-[0_14px_45px_rgba(83,49,58,0.06)] sm:p-8 lg:sticky lg:top-28"
              >
                <h2 className="font-serif text-2xl font-medium">Thông tin nhận hàng</h2>
                <div className="mt-6 space-y-4">
                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold">Họ và tên</span>
                    <input
                      required
                      name="name"
                      placeholder="Nguyễn Minh Anh"
                      className="h-12 w-full rounded-xl border border-[#eadde0] bg-[#fffafa] px-4 text-sm outline-none focus:border-[#ff8ca5] focus:ring-4 focus:ring-[#ff6b8b]/10"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold">Số điện thoại</span>
                    <input
                      required
                      name="phone"
                      type="tel"
                      placeholder="09xx xxx xxx"
                      onChange={() => {
                        setCheckoutPhoneError("");
                        setCheckoutError("");
                      }}
                      className="h-12 w-full rounded-xl border border-[#eadde0] bg-[#fffafa] px-4 text-sm outline-none focus:border-[#ff8ca5] focus:ring-4 focus:ring-[#ff6b8b]/10"
                    />
                    {checkoutPhoneError && (
                      <span className="mt-2 block text-xs font-medium text-[#d63f61]">
                        {checkoutPhoneError}
                      </span>
                    )}
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold">Địa chỉ nhận hàng</span>
                    <textarea
                      required
                      name="address"
                      rows={3}
                      placeholder="Số nhà, tên đường, phường/xã..."
                      className="w-full resize-none rounded-xl border border-[#eadde0] bg-[#fffafa] px-4 py-3 text-sm outline-none focus:border-[#ff8ca5] focus:ring-4 focus:ring-[#ff6b8b]/10"
                    />
                  </label>
                  <div className="flex items-center gap-3 rounded-xl border border-[#ffc4d0] bg-[#fff3f5] p-4">
                    <span className="grid h-4 w-4 place-items-center rounded-full border-[5px] border-[#ff6b8b] bg-white" />
                    <div>
                      <p className="text-sm font-semibold">Thanh toán khi nhận hàng</p>
                      <p className="mt-0.5 text-[11px] text-[#8a777d]">COD — An toàn và tiện lợi</p>
                    </div>
                  </div>
                </div>
                <div className="my-6 h-px bg-[#eadde0]" />
                <div className="flex items-center justify-between text-sm text-[#76656b]">
                  <span>Tạm tính ({cartCount} sản phẩm)</span>
                  <span>{formatPrice(cartTotal)}</span>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm text-[#76656b]">
                  <span>Phí vận chuyển</span>
                  <span className="font-semibold text-[#3f8b68]">Miễn phí</span>
                </div>
                <div className="mt-5 flex items-end justify-between">
                  <span className="font-semibold">Tổng cộng</span>
                  <span className="text-2xl font-bold text-[#e84f70]">
                    {formatPrice(cartTotal)}
                  </span>
                </div>
                {checkoutError && (
                  <div
                    role="alert"
                    className="mt-5 rounded-xl border border-[#ffc5d1] bg-[#fff0f3] px-4 py-3 text-sm leading-6 text-[#b93856]"
                  >
                    {checkoutError}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={submitting}
                  className="mt-6 h-14 w-full rounded-full bg-[#ff6b8b] font-semibold text-white shadow-[0_10px_28px_rgba(255,107,139,0.28)] transition hover:-translate-y-0.5 hover:bg-[#f45578] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                >
                  {submitting ? "Đang gửi đơn..." : checkoutError ? "Thử đặt lại" : "Đặt hàng"}
                </button>
                <p className="mt-4 text-center text-[11px] leading-5 text-[#9a898e]">
                  Bằng việc đặt hàng, bạn đồng ý với điều khoản mua hàng của BeautyStore.
                </p>
              </form>
            </div>
          )}
        </main>
      )}

      {page === "orders" && (
        <main className="mx-auto min-h-[650px] max-w-[900px] px-5 py-10 sm:px-8 sm:py-16">
          <div className="mb-9">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[#ff5e81]">
              Theo dõi mua sắm
            </p>
            <h1 className="font-serif text-4xl font-medium tracking-tight sm:text-5xl">
              Đơn hàng của bạn
            </h1>
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void loadOrders();
            }}
            className="flex flex-col gap-3 rounded-[24px] border border-[#eee0e3] bg-white p-5 shadow-[0_10px_35px_rgba(83,49,58,0.05)] sm:flex-row sm:p-6"
          >
            <label className="flex-1">
              <span className="mb-2 block text-xs font-semibold">Số điện thoại đặt hàng</span>
              <input
                type="tel"
                value={ordersPhone}
                onChange={(event) => {
                  setOrdersPhone(event.target.value);
                  setOrdersError("");
                }}
                placeholder="09xx xxx xxx"
                className="h-12 w-full rounded-xl border border-[#eadde0] bg-[#fffafa] px-4 text-sm outline-none focus:border-[#ff8ca5] focus:ring-4 focus:ring-[#ff6b8b]/10"
              />
            </label>
            <button
              type="submit"
              disabled={ordersLoading}
              className="h-12 self-end rounded-full bg-[#30292c] px-7 text-sm font-semibold text-white transition hover:bg-[#ff5e81] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {ordersLoading ? "Đang tải..." : "Xem đơn hàng"}
            </button>
          </form>

          {ordersError && (
            <div
              role="alert"
              className="mt-5 rounded-xl border border-[#ffc5d1] bg-[#fff0f3] px-4 py-3 text-sm text-[#b93856]"
            >
              {ordersError}
            </div>
          )}

          {!ordersLoading && !ordersError && !ordersSearched && (
            <div className="mt-8 rounded-[28px] border border-dashed border-[#e6cdd3] bg-white px-6 py-16 text-center">
              <span className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full bg-[#fff0f3] text-[#ff6b8b]">
                <Icon name="receipt" size={28} />
              </span>
              <h2 className="font-serif text-2xl">Tra cứu đơn hàng</h2>
              <p className="mt-2 text-sm text-[#827177]">
                Nhập số điện thoại đã dùng khi đặt hàng để xem các đơn của bạn.
              </p>
            </div>
          )}

          {!ordersLoading && !ordersError && ordersSearched && orders.length === 0 && (
            <div className="mt-8 rounded-[28px] border border-dashed border-[#e6cdd3] bg-white px-6 py-16 text-center">
              <h2 className="font-serif text-2xl">Chưa có đơn hàng</h2>
              <p className="mt-2 text-sm text-[#827177]">
                Không tìm thấy đơn hàng nào với số điện thoại này.
              </p>
            </div>
          )}

          {orders.length > 0 && (
            <div className="mt-8 space-y-5">
              {orders.map((order) => {
                const status = statusDetails[order.status] ?? statusDetails.PENDING;
                return (
                  <article
                    key={order.orderId}
                    className="rounded-[24px] border border-[#eee0e3] bg-white p-5 shadow-[0_8px_30px_rgba(83,49,58,0.04)] sm:p-7"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#f0e3e6] pb-5">
                      <div>
                        <h2 className="font-serif text-2xl font-semibold">Đơn #{order.orderId}</h2>
                        <p className="mt-1 text-xs text-[#8a777d]">
                          {new Intl.DateTimeFormat("vi-VN", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          }).format(new Date(order.createdAt))}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3.5 py-2 text-xs font-bold ${status.className}`}
                      >
                        {status.label}
                      </span>
                    </div>
                    <div className="divide-y divide-[#f3e8ea]">
                      {order.items.map((item) => (
                        <div
                          key={`${order.orderId}-${item.productId}`}
                          className="flex items-center justify-between gap-4 py-4 text-sm"
                        >
                          <span className="font-medium">
                            {item.name} × {item.quantity}
                          </span>
                          <span className="shrink-0 text-[#76656b]">
                            {formatPrice(item.price * item.quantity)}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-end justify-between border-t border-[#eadde0] pt-5">
                      <span className="font-semibold">Tổng cộng</span>
                      <span className="text-xl font-bold text-[#e84f70]">
                        {formatPrice(order.total)}
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </main>
      )}

      <footer className="border-t border-[#f0e0e4] bg-white/60">
        <div className="mx-auto flex max-w-[1240px] flex-col items-center justify-between gap-3 px-5 py-7 text-xs text-[#8e7d82] sm:flex-row sm:px-8">
          <span className="font-serif text-base font-semibold text-[#504348]">
            Beauty<span className="text-[#ff5e81]">Store</span>
          </span>
          <p>Chăm sóc làn da, yêu thương chính mình.</p>
          <p>© 2025 BeautyStore</p>
        </div>
      </footer>

      <div
        className={`fixed top-24 right-5 z-50 flex max-w-[360px] items-center gap-3 rounded-2xl bg-[#30292c] px-5 py-4 text-sm font-medium text-white shadow-2xl transition-all duration-300 ${toast ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-8 opacity-0"}`}
      >
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#ff6b8b]">
          <Icon name="check" size={15} />
        </span>
        {toast}
      </div>
    </div>
  );
}
