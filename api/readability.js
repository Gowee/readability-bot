const {
  EASTER_EGG_PAGE,
  buildReadableMeta,
  renderReadablePage,
} = require("../lib/server/readability");

module.exports = async (request, response) => {
  if ((request.headers["user-agent"] ?? "").includes("readability-bot")) {
    response.send(EASTER_EGG_PAGE);
    return;
  }
  const { url, type } = request.query;
  const format = request.query.format ?? type;

  if (!url && format !== "json") {
    response.redirect("/");
    return;
  }

  try {
    const { meta, cacheControl } = await buildReadableMeta(url, request.headers);
    response.setHeader("cache-control", cacheControl);

    if (format === "json") {
      response.status(200).json(meta);
      return;
    }

    response.setHeader("content-type", "text/html; charset=utf-8");
    response.status(200).send(renderReadablePage(meta, request));
  } catch (error) {
    console.error(error);
    response.status(error.statusCode ?? 500).send(error.message ?? String(error));
    return;
  }
};
