const Paginator = require('./paginator');

// apiResponse.pagination({ res, data, pagination });
async function pagination(params) {
  const respon = { success: true, pagination: null, data: null };

  if ('status' in params) Object.assign(respon, { success: params.status });
  if ('pagination' in params) {
    delete params.pagination.data;
    Object.assign(respon, { pagination: params.pagination });
  }
  if ('data' in params) Object.assign(respon, { data: params.data });

  return params.res.status(200).json(respon);
}

async function paginationFindAll(params) {
  const paginator = new Paginator(params.page, params.limit);
  paginator.setCount(params.count);
  paginator.setData(params.data);
  const p = paginator.getPaginator();
  return params.res.status(200).json({
    success: true,
    pagination: {
      currentPage: p.currentPage,
      perPage: p.perPage,
      lastPage: p.lastPage,
      countAllData: p.countAllData,
      pages: p.pages
    },
    data: p.data
  });
}

// apiResponse.noPagination({ res, page, limit, data });
async function noPagination(params) {
  const respon = { success: true, meta: null, data: null };

  if (params.status) Object.assign(respon, { success: params.status });
  if (params.message) Object.assign(respon, { meta: { message: params.message } });
  if (params.data) Object.assign(respon, { data: params.data.rows });

  return params.res.status(200).json(respon);
}

// apiResponse._success({ res, data });
async function _success(params) {
  const respon = { success: true, data: null };

  if ('status' in params) Object.assign(respon, { success: params.status });
  if ('data' in params) Object.assign(respon, { data: params.data });

  return params.res.status(200).json(respon);
}

// apiResponse._error({ res, errors: 'member not found', code: 404 });
async function _error(params) {
  const respon = { success: false, errors: null };

  if ('status' in params) Object.assign(respon, { success: params.status });
  if ('errors' in params) Object.assign(respon, { errors: params.errors });
  if ('backend' in params) Object.assign(respon, { backend: params.backend });

  const code = 'code' in params ? params.code : 422;
  return params.res.status(code).json(respon);
}

module.exports = {
  pagination,
  noPagination,
  paginationFindAll,
  _success,
  _error
};
