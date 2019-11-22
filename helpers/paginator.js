function paging(page, count, limit) {
  return {
    currentPage: parseInt(page, 10),
    lastPage: parseInt(count / limit, 10) + parseInt(count % limit !== 0 ? 1 : 0, 10),
    count,
    recordPerPage: parseInt(limit, 10)
  };
}

module.exports = {
  paging
};
