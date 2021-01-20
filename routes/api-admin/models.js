/* eslint-disable linebreak-style */
const express = require("express");
const validator = require("validator");
const Sequelize = require("sequelize");
const models = require("../../db/models");
const paginator = require("../../helpers/paginator");

const { Op } = Sequelize;
const router = express.Router();

const DEFAULT_LIMIT = process.env.DEFAULT_LIMIT || 10;
const MAX_LIMIT = process.env.MAX_LIMIT || 50;

router.get("/", async (req, res) => {
  let { page, limit, sort } = req.query;
  let offset = 0;

  if (validator.isInt(limit ? limit.toString() : "") === false) limit = DEFAULT_LIMIT;
  if (parseInt(limit) > MAX_LIMIT) limit = MAX_LIMIT;
  if (validator.isInt(page ? page.toString() : "")) offset = (page - 1) * limit;
  else page = 1;

  const order = [["createdAt", "desc"]];
  if (!sort) sort = "asc";
  else if (sort !== "asc" && sort !== "desc") sort = "asc";

  const where = {};

  // return res.status(200).json({ order, where, offset});

  return models.Model.findAll({
    include: [
      {
        model: models.GroupModel,
        as: 'groupModel',
        include: [
          {
            model: models.Brand,
            as: 'brand'
          }
        ]
      }
    ],
    where,
    order,
    offset,
    limit
  })
    .then(async data => {
      // const count = await models.Model.count({ where });
      // const pagination = paginator.paging(page, count, limit);

      return res.json({
        success: true,
        // pagination,
        data
      });
    })
    .catch(err => {
      return res.status(422).json({
        success: false,
        errors: err.message
      });
    });
});

router.get("/id/:id", async (req, res) => {
  const { id } = req.params;

  return models.Model.findOne({
    include: [
      {
        model: models.GroupModel,
        as: "groupModel"
      }
    ],
    where: {
      id
    }
  }).then(data => {
    res
      .json({
        success: true,
        data
      })
      .catch(err => {
        res.status(422).json({
          success: false,
          errors: err.message
        });
      });
  });
});

router.get("/groupModel/:id", async (req, res) => {
  const { id } = req.params;

  return models.Model.findAll({
    include: [
      {
        model: models.GroupModel,
        as: "groupModel"
      }
    ],
    where: {
      groupModelId: id
    }
  })
    .then(data => {
      res.json({
        success: true,
        data
      });
    })
    .catch(err => {
      res.status(422).json({
        success: false,
        errors: err.message
      });
    });
});

router.post("/", async (req, res) => {
  const { name, groupModelId } = req.body;
  if (!name) {
    return res.status(400).json({
      success: false,
      errors: "name is mandatory"
    });
  }
  if (!groupModelId) {
    return res.status(400).json({
      success: false,
      errors: "groupModelId is mandatory"
    });
  }

  const dataUnique = await models.Model.findOne({
    where: {
      name: {
        [Op.iLike]: this.name
      }
    }
  });
  if (dataUnique) {
    return res.status(400).json({
      success: false,
      errors: "Model name already exist"
    });
  }

  return models.Model.create({
    name,
    groupModelId
  })
    .then(data => {
      res.json({
        success: true,
        data
      });
    })
    .catch(err => {
      res.status(422).json({
        success: false,
        errors: err.message
      });
    });
});

router.put("/id/:id", async (req, res) => {
  const { id } = req.params;
  if (validator.isInt(id ? id.toString() : "") === false) {
    return res.status(400).json({
      success: false,
      errors: "Invalid Parameter"
    });
  }
  const data = await models.Model.findByPk(id);
  if (!data) {
    return res.status(400).json({
      success: false,
      errors: "Model not found"
    });
  }

  const { name, groupModelId } = req.body;

  if (!name) {
    return res.status(400).json({
      success: false,
      errors: "name is mandatory"
    });
  }

  const dataUnique = await models.Model.findOne({
    where: {
      name: {
        [Op.iLike]: this.name
      }
    }
  });
  if (dataUnique) {
    return res.status(400).json({
      success: false,
      errors: "Model name already exist"
    });
  }

  return data
    .update({
      name,
      groupModelId
    })
    .then(() => {
      res.json({
        success: true,
        data
      });
    })
    .catch(err => {
      res.status(422).json({
        success: false,
        errors: err.message
      });
    });
});

router.delete("/id/:id", async (req, res) => {
  const { id } = req.params;
  if (validator.isInt(id ? id.toString() : "") === false) {
    return res.status(400).json({
      success: false,
      errors: "Invalid Parameter"
    });
  }
  const data = await models.Model.findByPk(id);
  return data
    .destroy()
    .then(() => {
      res.json({
        success: true,
        data
      });
    })
    .catch(err => {
      res.status(422).json({
        success: true,
        errors: err.message
      });
    });
});

module.exports = router;
