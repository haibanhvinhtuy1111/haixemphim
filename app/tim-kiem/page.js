import Link from "next/link";
import MovieCard from "../../components/MovieCard";
import { search } from "../../lib/api";

export const dynamic = "force-dynamic";

export default async function SearchPage({ searchParams }) {
  const sp = await searchParams;
  const keyword = (sp?.keyword || "").trim();
  const page = Math.max(1, parseInt(sp?.page || "1", 10) || 1);

  const { items, totalPages } =
    keyword.length >= 2
      ? await search(keyword, page)
      : { items: [], totalPages: 1 };

  const href = (p) =>
    `/tim-kiem?keyword=${encodeURIComponent(keyword)}&page=${p}`;

  return (
    <main className="wrap">
      <h1>Tìm phim</h1>

      <form className="card">
        <div className="searchbox">
          <input
            className="input"
            name="keyword"
            defaultValue={keyword}
            placeholder="Nhập tên phim (tối thiểu 2 ký tự)"
            aria-label="Tên phim"
          />
          <button className="btn" type="submit">Tìm kiếm</button>
        </div>
      </form>

      {keyword.length >= 2 && items.length === 0 && (
        <div className="notice">
          Không tìm thấy phim nào cho “{keyword}”. Thử từ khóa ngắn hơn hoặc tên
          tiếng Anh.
        </div>
      )}

      {items.length > 0 && (
        <>
          <h2>Kết quả cho “{keyword}”</h2>
          <div className="grid">
            {items.map((m) => (
              <MovieCard key={m.slug} m={m} />
            ))}
          </div>
          <div className="pager">
            {page > 1 && <Link href={href(page - 1)}>Trang trước</Link>}
            {page < totalPages && <Link href={href(page + 1)}>Trang sau</Link>}
          </div>
        </>
      )}
    </main>
  );
}
