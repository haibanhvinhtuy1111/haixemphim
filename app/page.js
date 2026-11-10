import Link from "next/link";
import MovieCard from "../components/MovieCard";
import { getList } from "../lib/api";

export const revalidate = 300;

const TYPES = [
  ["phim-moi-cap-nhat", "Mới cập nhật"],
  ["phim-bo", "Phim bộ"],
  ["phim-le", "Phim lẻ"],
  ["hoat-hinh", "Hoạt hình"]
];

export default async function Home({ searchParams }) {
  const sp = await searchParams;
  const type = sp?.type || "phim-moi-cap-nhat";
  const page = Math.max(1, parseInt(sp?.page || "1", 10) || 1);
  const { items, totalPages } = await getList(type, page);
  const q = (p) => `/?type=${type}&page=${p}`;

  return (
    <main className="wrap">
      <h1>Kho phim</h1>

      <form action="/tim-kiem" className="card">
        <div className="searchbox">
          <input
            className="input"
            name="keyword"
            placeholder="Nhập tên phim"
            aria-label="Tên phim"
          />
          <button className="btn" type="submit">Tìm kiếm</button>
        </div>
        <div className="chips">
          {TYPES.map(([k, label]) => (
            <Link
              key={k}
              href={`/?type=${k}`}
              className={`chip ${k === type ? "on" : ""}`}
            >
              {label}
            </Link>
          ))}
        </div>
      </form>

      {items.length === 0 ? (
        <div className="notice">
          Chưa tải được danh sách phim. Thử lại sau ít phút.
        </div>
      ) : (
        <>
          <h2>{TYPES.find((t) => t[0] === type)?.[1] || "Phim"}</h2>
          <div className="grid">
            {items.map((m) => (
              <MovieCard key={m.slug} m={m} />
            ))}
          </div>
          <div className="pager">
            {page > 1 ? (
              <Link href={q(page - 1)}>Trang trước</Link>
            ) : (
              <span className="dim">Trang trước</span>
            )}
            <span>{page} / {totalPages}</span>
            {page < totalPages ? (
              <Link href={q(page + 1)}>Trang sau</Link>
            ) : (
              <span className="dim">Trang sau</span>
            )}
          </div>
        </>
      )}
    </main>
  );
}
