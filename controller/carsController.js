const validator = require('validator');
const Sequelize = require('sequelize');
const models = require('../db/models');
const paginator = require('../helpers/paginator');
const calculateDistance = require('../helpers/calculateDistance');
const carHelper = require('../helpers/car');
const general = require('../helpers/general');
const notification = require('../helpers/notification');

const { Op } = Sequelize;

const DEFAULT_LIMIT = process.env.DEFAULT_LIMIT || 10;
const MAX_LIMIT = process.env.MAX_LIMIT || 50;

async function carsGet(req, res, auth = false) {
  const {
    groupModelId,
    modelId,
    brandId,
    condition,
    modelYearId,
    minPrice,
    maxPrice,
    minYear,
    maxYear,
    radius,
    cityId,
    subdistrictId,
    exteriorColorId,
    interiorColorId,
    minKm,
    maxKm,
    profileUser
  } = req.query;
  let { latitude, longitude } = req.query;
  let { page, limit, by, sort } = req.query;
  let offset = 0;

  if (validator.isInt(limit ? limit.toString() : '') === false) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;
  if (validator.isInt(page ? page.toString() : '')) offset = (page - 1) * limit;
  else page = 1;

  if (!by) by = 'id';
  const array = [
    'id',
    'userId',
    'brandId',
    'modelId',
    'groupModelId',
    'modelYearId',
    'exteriorColorId',
    'interiorColorId',
    'price',
    'condition',
    'usedFrom',
    'frameNumber',
    'engineNumber',
    'STNKnumber',
    'STNKphoto',
    'location',
    'status',
    'km',
    'createdAt',
    'view',
    'like',
    'profile',
    'area'
  ];
  if (array.indexOf(by) < 0) by = 'createdAt';
  sort = ['asc', 'desc'].indexOf(sort) < 0 ? 'asc' : sort;
  const order = [];
  switch (by) {
    case 'view':
    case 'like':
      order.push([Sequelize.col(by), sort]);
      break;
    case 'area':
      order.push([Sequelize.col(`distance`), sort]);
      break;
    case 'profile':
      order.push([{ model: models.User, as: 'user' }, 'type', sort]);
      break;
    default:
      order.push([by, sort]);
      break;
  }

  const userId = auth ? req.user.id : null;
  const addAttributes = {
    fields: [
      'like',
      'islike',
      'isBid',
      'view',
      'highestBidder',
      'numberOfBidder',
      'sumBargains',
      'bidAmount'
    ],
    upperCase: true,
    id: userId
  };
  
  const where = {};
  const whereUser = {};

  if (modelYearId) {
    Object.assign(where, {
      modelYearId
    });
  }

  if (groupModelId) {
    Object.assign(where, {
      groupModelId
    });
  }

  if (condition) {
    Object.assign(where, {
      condition
    });
  }

  if (modelId) {
    Object.assign(where, {
      modelId
    });
  }

  if (brandId) {
    Object.assign(where, {
      brandId
    });
  }

  if (exteriorColorId) {
    Object.assign(where, {
      exteriorColorId
    });
  }

  if (interiorColorId) {
    Object.assign(where, {
      interiorColorId
    });
  }

  if (profileUser == 'End User') {
    Object.assign(whereUser, {
      [Op.or]: [
        { type: 0, companyType: 0 },
        { type: 0, companyType: 1 }
      ]
    });
  }

  if (profileUser == 'Dealer') {
    Object.assign(whereUser, {
      [Op.or]: [
        { type: 1, companyType: 0 },
        { type: 1, companyType: 1 }
      ]
    });
  }

  if (minKm && maxKm) {
    Object.assign(where, {
      km: {
        [Op.and]: [{ [Op.gte]: minKm }, { [Op.lte]: maxKm }]
      }
    });
  } else if (minKm) {
    Object.assign(where, {
      km: {
        [Op.gte]: minKm
      }
    });
  } else if (maxKm) {
    Object.assign(where, {
      km: {
        [Op.lte]: maxKm
      }
    });
  }

  if (minPrice && maxPrice) {
    Object.assign(where, {
      price: {
        [Op.and]: [{ [Op.gte]: minPrice }, { [Op.lte]: maxPrice }]
      }
    });
  } else if (minPrice) {
    Object.assign(where, {
      price: {
        [Op.gte]: minPrice
      }
    });
  } else if (maxPrice) {
    Object.assign(where, {
      price: {
        [Op.lte]: maxPrice
      }
    });
  }

  const whereYear = {};
  if (minYear && maxYear) {
    Object.assign(whereYear, {
      year: {
        [Op.and]: [{ [Op.gte]: minYear }, { [Op.lte]: maxYear }]
      }
    });
  } else if (minYear) {
    Object.assign(whereYear, {
      year: {
        [Op.gte]: minYear
      }
    });
  } else if (maxYear) {
    Object.assign(whereYear, {
      year: {
        [Op.lte]: maxYear
      }
    });
  }

  // Search By Location (Latitude, Longitude & Radius) (For Pin Map)
  if (by === 'location') {
    if (!latitude) {
      return res.status(400).json({
        success: false,
        errors: 'Latitude not found!'
      });
    }

    if (!longitude) {
      return res.status(400).json({
        success: false,
        errors: 'Longitude not found!'
      });
    }

    if (!radius) {
      return res.status(400).json({
        success: false,
        errors: 'Radius not found!'
      });
    }

    await calculateDistance.CreateOrReplaceCalculateDistance();
    const distances = models.sequelize.literal(
      `(SELECT calculate_distance(${latitude}, ${longitude}, (SELECT CAST(COALESCE(NULLIF((SELECT split_part("Car"."location", ',', 1)), ''), '0') AS NUMERIC) AS "latitude"), (SELECT CAST(COALESCE(NULLIF((SELECT split_part("Car"."location", ',', 2)), ''), '0') AS NUMERIC) AS "longitude"), 'K'))`
    );
    Object.assign(where, {
      [Op.and]: [models.sequelize.where(distances, { [Op.lte]: radius })]
    });

    addAttributes.fields.push('distance');
    Object.assign(addAttributes, {
      latitude,
      longitude
    });
  }

  if (by === 'area') {
    if (cityId) {
      const city = await models.City.findByPk(cityId);
      if (!city) return res.status(400).json({ success: false, errors: 'City not found!' });

      if (subdistrictId) {
        const subdistrict = await models.SubDistrict.findOne({
          where: { id: subdistrictId, cityId }
        });

        if (!subdistrict)
          return res.status(400).json({ success: false, errors: 'Subdistrict not found!' });

        if (city && subdistrict) {
          latitude = subdistrict.latitude;
          longitude = subdistrict.longitude;
        }
      } else if (city) {
        latitude = city.latitude;
        longitude = city.longitude;
      }

      await calculateDistance.CreateOrReplaceCalculateDistance();
      const distances = Sequelize.literal(
        `(SELECT calculate_distance(${latitude}, ${longitude}, (SELECT CAST(COALESCE(NULLIF((SELECT split_part("Car"."location", ',', 1)), ''), '0') AS NUMERIC) AS "latitude"), (SELECT CAST(COALESCE(NULLIF((SELECT split_part("Car"."location", ',', 2)), ''), '0') AS NUMERIC) AS "longitude"), 'K'))`
      );

      if (radius) {
        Object.assign(where, {
          where: {
            [Op.and]: [Sequelize.where(distances, { [Op.lte]: Number(radius) })]
          }
        });
      } else if (cityId && subdistrictId) {
        Object.assign(where, {
          cityId,
          subdistrictId
        });
      } else if (cityId) {
        Object.assign(where, {
          cityId
        });
      }

      addAttributes.fields.push('distance');
      Object.assign(addAttributes, {
        latitude,
        longitude
      });
    } else {
      return res.status(400).json({ success: false, errors: 'Please Select City!' });
    }
  }

  if (latitude && longitude && radius && by != 'area' && by != 'location') {
    await calculateDistance.CreateOrReplaceCalculateDistance();
    const distances = Sequelize.literal(
      `(SELECT calculate_distance(${latitude}, ${longitude}, (SELECT CAST(COALESCE(NULLIF((SELECT split_part("Car"."location", ',', 1)), ''), '0') AS NUMERIC) AS "latitude"), (SELECT CAST(COALESCE(NULLIF((SELECT split_part("Car"."location", ',', 2)), ''), '0') AS NUMERIC) AS "longitude"), 'K'))`
    );

    Object.assign(where, {
      where: {
        [Op.and]: [Sequelize.where(distances, { [Op.lte]: Number(radius) })]
      }
    });

    addAttributes.fields.push('distance');
    Object.assign(addAttributes, {
      latitude,
      longitude
    });
  }

  if (
    cityId &&
    subdistrictId &&
    radius == '' &&
    (latitude == '') & (longitude == '') &&
    by != 'area' &&
    by != 'location'
  ) {
    const city = await models.City.findByPk(cityId);
    if (!city) return res.status(400).json({ success: false, errors: 'City not found!' });

    if (subdistrictId) {
      const subdistrict = await models.SubDistrict.findOne({
        where: { id: subdistrictId, cityId }
      });

      if (!subdistrict)
        return res.status(400).json({ success: false, errors: 'Subdistrict not found!' });

      if (city && subdistrict) {
        latitude = subdistrict.latitude;
        longitude = subdistrict.longitude;
      }
    } else if (city) {
      latitude = city.latitude;
      longitude = city.longitude;
    }

    if (cityId && subdistrictId) {
      Object.assign(where, {
        cityId,
        subdistrictId
      });
    } else if (cityId) {
      Object.assign(where, {
        cityId
      });
    }

    addAttributes.fields.push('distance');
    Object.assign(addAttributes, {
      latitude,
      longitude
    });
  }

  const addAttribute = await carHelper.customFields(addAttributes);

  return models.Car.findAll({
    attributes: Object.keys(models.Car.attributes).concat(addAttribute),
    include: [
      {
        model: models.ModelYear,
        as: 'modelYear',
        attributes: ['id', 'year', 'modelId'],
        where: whereYear
      },
      {
        model: models.User,
        as: 'user',
        attributes: ['id', 'name', 'email', 'phone', 'type', 'companyType'],
        where: whereUser,
        include: [
          {
            model: models.Purchase,
            as: 'purchase',
            attributes: {
              exclude: ['deletedAt']
            },
            order: [['id', 'desc']],
            limit: 1
          }
        ]
      },
      {
        model: models.Brand,
        as: 'brand',
        attributes: ['id', 'name', 'logo', 'status']
      },
      {
        model: models.Model,
        as: 'model',
        attributes: ['id', 'name', 'groupModelId']
      },
      {
        model: models.GroupModel,
        as: 'groupModel',
        attributes: ['id', 'name', 'brandId']
      },
      {
        model: models.Color,
        as: 'interiorColor',
        attributes: ['id', 'name', 'hex']
      },
      {
        model: models.Color,
        as: 'exteriorColor',
        attributes: ['id', 'name', 'hex']
      },
      {
        model: models.MeetingSchedule,
        as: 'meetingSchedule',
        attributes: ['id', 'carId', 'day', 'startTime', 'endTime']
      },
      {
        model: models.InteriorGalery,
        as: 'interiorGalery',
        attributes: ['id', 'fileId', 'carId'],
        include: [
          {
            model: models.File,
            as: 'file'
          }
        ]
      },
      {
        model: models.ExteriorGalery,
        as: 'exteriorGalery',
        attributes: ['id', 'fileId', 'carId'],
        include: [
          {
            model: models.File,
            as: 'file'
          }
        ]
      },
      {
        required: false,
        model: models.Bargain,
        as: 'bargain',
        attributes: ['id', 'userId', 'carId', 'haveSeenCar', 'paymentMethod', 'expiredAt'],
        limit: 1,
        order: [['id', 'desc']]
      }
    ],
    where,
    order,
    offset,
    limit
  })
    .then(async data => {
      const count = await models.Car.count({
        include: [
          {
            model: models.ModelYear,
            as: 'modelYear',
            attributes: ['id', 'year', 'modelId'],
            where: whereYear
          }
        ],
        where
      });
      const pagination = paginator.paging(page, count, limit);

      res.json({
        success: true,
        pagination,
        data
      });
    })
    .catch(err => {
      console.log(err);
      res.status(422).json({
        success: false,
        errors: err.message
      });
    });
}

async function sell(req, res) {
  const {
    userId,
    brandId,
    groupModelId,
    modelId,
    modelYearId,
    exteriorColorId,
    interiorColorId,
    price,
    condition,
    usedFrom,
    frameNumber,
    engineNumber,
    STNKnumber,
    location,
    status,
    interior,
    exterior,
    day,
    startTime,
    endTime,
    km,
    address
  } = req.body;

  let { city, subdistrict } = req.body;
  const { images } = req.files;

  if (!userId) return res.status(400).json({ success: false, errors: 'user is mandatory' });
  if (!brandId) return res.status(400).json({ success: false, errors: 'brand is mandatory' });
  if (!groupModelId) return res.status(400).json({ success: false, errors: 'groupModel is mandatory' });
  if (!modelId) return res.status(400).json({ success: false, errors: 'model is mandatory' });
  if (!modelYearId) return res.status(400).json({ success: false, errors: 'model year is mandatory' });
  if (!location) {
    return res.status(400).json({ success: false, errors: 'location is mandatory' });
  } else {
    let locations = location.split(',');
    locations[0] = general.customReplace(locations[0], ' ', '');
    locations[1] = general.customReplace(locations[1], ' ', '');
    if (validator.isNumeric(locations[0] ? locations[0].toString() : '') === false)
      return apiResponse._error({ res, errors: 'invalid latitude' });
    if (validator.isNumeric(locations[1] ? locations[1].toString() : '') === false)
      return apiResponse._error({ res, errors: 'invalid longitude' });
  }
  if (km) {
    if (validator.isInt(km) === false)
      return res.status(422).json({ success: false, errors: 'km is number' });
  }

  let STNKphoto = null;
  const result = {};
  if (images) {
    const tname = randomize('0', 4);
    result.name = `djublee/images/car/${tname}${moment().format('x')}${unescape(
      images[0].originalname
    ).replace(/\s/g, '')}`;
    result.mimetype = images[0].mimetype;
    result.data = images[0].buffer;
    STNKphoto = result.name;
    // imageHelper.uploadToS3(result);
  }
  const errors = [];
  const insert = {
    userId,
    brandId,
    modelId,
    groupModelId,
    modelYearId,
    exteriorColorId,
    interiorColorId,
    price,
    condition,
    usedFrom,
    frameNumber,
    engineNumber,
    STNKnumber,
    STNKphoto,
    location: location.replace(/\s/g, ''),
    status,
    km,
    oldPrice:price
  };

  if (address) Object.assign(insert, { address });

  if(subdistrict && city) {
    city = city.toLowerCase().replace('kota', '').replace('city', '').trim();
    subdistrict = subdistrict.toLowerCase().replace('kec.', '').replace('kecamatan', '').trim();

    const subDistrictExist = await models.SubDistrict.findOne({
      include: [
        {
          model: models.City,
          as: 'city',
          where: {
            name: {
              [Op.iLike]: `%${city}%`
            }
          }
        }
      ],
      where: {
        name: {
          [Op.iLike]: `%${subdistrict}%`
        }
      }
    });

    if(!subDistrictExist) {
      return res.status(422).json({ success: false, errors: 'subdistrict not found' });
    }

    const cityExist = await models.City.findOne({
      where: {
        id: subDistrictExist.cityId,
        name: {
          [Op.iLike]: `%${city}%`
        }
      }
    });

    if(!cityExist) {
      return res.status(422).json({ success: false, errors: 'city not found' });
    }

    Object.assign(insert, { subdistrictId: subDistrictExist.id });
    Object.assign(insert, { cityId: cityExist.id });
  }

  const userNotifs = [];
  const otherBidders = await models.Bargain.aggregate('Bargain.userId', 'DISTINCT', {
    plain: false,
    include:[
      {
        model: models.Car,
        as: 'car',
        attributes: [],
        where: {
          brandId,
          modelId,
          groupModelId
        }
      }
    ],
    where: {
      userId: {
        [Op.ne]: req.user.id
      }
    }
  });  
  otherBidders.map(async otherBidder => {
    userNotifs.push({
      userId: otherBidder.DISTINCT,
      collapseKey: null,
      notificationTitle: `Notifikasi Beli`,
      notificationBody: `mobil sejenis`,
      notificationClickAction: `similiarCarBeli`,
      dataReferenceId: 123,
      category: 2,
      status: 1,
      tab: `tabBeli`
    });
  });

  const otherCarSells = await models.Car.aggregate('userId', 'DISTINCT', {
    plain: false,
    where: {
      brandId,
      modelId,
      groupModelId,
      userId: {
        [Op.ne]: req.user.id
      }
    }
  });
  otherCarSells.map(async otherCarSell => {
    userNotifs.push({
      userId: otherCarSell.DISTINCT,
      collapseKey: null,
      notificationTitle: `Notifikasi Jual`,
      notificationBody: `mobil sejenis`,
      notificationClickAction: `similiarCarSell`,
      dataReferenceId: 123,
      category: 1,
      status: 2,
      tab: `tabJual`
    });
  });
  
  // return apiResponse._success({
  //   res,
  //   data: {otherBidders, userNotifs}
  // });

  const trans = await models.sequelize.transaction();
  const data = await models.Car.create(insert, {
    transaction: trans
  }).catch(err => {
    trans.rollback();
    return res.status(422).json({
      success: false,
      errors: err.message
    });
  });

  if (Object.keys(result).length > 0) imageHelper.uploadToS3(result);

  if (interior) {
    let { interiorGalery } = [];
    interiorGalery = await general.mapping(interior);
    await Promise.all(
      interiorGalery.map(async interiorData => {
        await models.InteriorGalery.create(
          {
            carId: data.id,
            fileId: interiorData
          },
          {
            transaction: trans
          }
        ).catch(err => {
          errors.push(err);
        });
      })
    );
  }

  if (exterior) {
    let { exteriorGalery } = [];
    exteriorGalery = await general.mapping(exterior);
    await Promise.all(
      exteriorGalery.map(async exteriorData => {
        await models.ExteriorGalery.create(
          {
            carId: data.id,
            fileId: exteriorData
          },
          {
            transaction: trans
          }
        ).catch(err => {
          errors.push(err);
        });
      })
    );
  }

  if (day && startTime && endTime) {
    let { dayTemp, startTimeTemp, endTimeTemp } = [];
    dayTemp = general.mapping(day);
    startTimeTemp = general.mapping(startTime);
    endTimeTemp = general.mapping(endTime);

    const schedule = [];
    for (let i = 0; i < dayTemp.length; i += 1) {
      schedule.push({
        carId: data.id,
        day: dayTemp[i],
        startTime: startTimeTemp[i],
        endTime: endTimeTemp[i]
      });
    }

    await models.MeetingSchedule.bulkCreate(schedule, { transaction: trans }).catch(err => {
      errors.push(err);
    });
  }

  if (errors.length > 0) {
    trans.rollback();
    return res.status(422).json({
      success: false,
      errors
    });
  }
  trans.commit();

  userNotifs.map(async userNotif => {
    Object.assign(userNotif, {
      dataReferenceId: data.id
    });
    const emit = await notification.insertNotification(userNotif);
    req.io.emit(`${userNotif.tab}-${userNotif.userId}`, emit);
    notification.userNotif(userNotif);
    console.log(userNotif);
  });

  return res.json({
    success: true,
    data
  });
}

module.exports = {
  carsGet,
  sell
};
