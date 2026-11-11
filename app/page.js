import Link from "next/link";
import MovieCard from "../components/MovieCard";
import { getList, search } from "../lib/api";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "phim-moi-cap-nhat", label: "Mới cập nhật" },
  { key: "phim-bo", label: "Phim bộ" },
  { key: "phim-le", label: "Phim lẻ" },
  { key: "hoat-hinh", label: "Hoạt hình" }
];

const str = (v) =>
  typeof v === "string" || typeof v === "number" ? String(v).trim() : "";

export default async function HomePage({ searchParams }) {
  try {
    const sp = (await searchParams) || {};
    const type = str(sp.type) || "phim-moi-cap-nhat";
    const q = str(sp.q || sp.keyword);
    const page = Math.max(1, Number(sp.page) || 1);

    const data = q ? await search(q, page) : await getList(type, page);
    const items = Array.isArray(data?.items) ? data.items : [];
    const totalPages = Math.max(1, Number(data?.totalPages) || 1);

    const buildPageHref = (targetPage) => {
      if (q) {
        return `/?q=${encodeURIComponent(q)}&page=${targetPage}`;
      }
      return `/?type=${encodeURIComponent(type)}&page=${targetPage}`;
    };

    return (
      <main className="wrap" style={{ paddingBottom: 100 }}>
        <h1>Kho phim</h1>

        <div className="card" style={{ padding: 16, marginBottom: 20 }}>
          <form
            action="/"
            method="GET"
            style={{ display: "flex", gap: 10, marginBottom: 12 }}
          >
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Nhập tên phim"
              style={{ flex: 1 }}
            />
            <button type="submit" className="btn">
              Tìm kiếm
            </button>
          </form>

          <div className="chips">
            {TABS.map((t) => (
              <Link
                key={t.key}
                href={`/?type=${t.key}`}
                className={`chip ${!q && type === t.key ? "active" : ""}`}
              >
                {t.label}
              </Link>
            ))}
          </div>
        </div>

        {items.length === 0 ? (
          <div className="notice">
            Chưa tải được danh sách phim. Thử lại sau ít phút.
          </div>
        ) : (
          <>
            <div
              className="grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(165px, 1fr))",
                gap: 16
              }}
            >
              {items.map((it, idx) => (
                <MovieCard
                  key={it._id || it.slug || idx}
                  item={it}
                  movie={it}
                  m={it}
                />
              ))}
            </div>

            {totalPages > 1 && (
              <div
                className="chips"
                style={{
                  marginTop: 24,
                  justifyContent: "center",
                  alignItems: "center",
                  gap: 10
                }}
              >
                {page > 1 && (
                  <Link href={buildPageHref(page - 1)} className="chip">
                    ← Trang trước
                  </Link>
                )}

                <span className="chip active">
                  Trang {page} / {totalPages}
                </span>

                {page < totalPages && (
                  <Link href={buildPageHref(page + 1)} className="chip">
                    Trang sau →
                  </Link>
                )}
              </div>
            )}
          </>
        )}
      </main>
    );
  } catch (err) {
    return (
      <main className="wrap" style={{ paddingBottom: 100 }}>
        <h1>Kho phim</h1>
        <div className="notice">
          Đã xảy ra lỗi khi tải trang: {String(err?.message || err)}
        </div>
      </main>
    );
  }
}
