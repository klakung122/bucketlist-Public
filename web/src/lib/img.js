export const toImgSrc = (v) => {
    if (!v) return "";
    if (typeof v !== "string") v = String(v).trim();
    if (!v) return "";

    if (/^(https?:|blob:|data:)/i.test(v)) return v;

    let path = v.startsWith("/") ? v : `/${v.replace(/^\/+/, "")}`;

    if (path.startsWith("/uploads/")) {
        return `${process.env.NEXT_PUBLIC_API_BASE.replace(/\/+$/, "")}${path}`;
    }

    return path;
};