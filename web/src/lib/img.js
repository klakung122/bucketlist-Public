export const toImgSrc = (v) => {
    if (!v) return "";
    if (typeof v !== "string") v = String(v);
    if (/^https?:\/\//i.test(v)) return v;
    return "/" + v.replace(/^\/+/, "");
};