const Sequelize = require('sequelize');
const models = require('../db/models');

async function CreateOrReplaceCalculateDistance() {
  const calculateDistanceFunction = `CREATE OR REPLACE FUNCTION "public"."calculate_distance"("lat1" float8, "lon1" float8, "lat2" float8, "lon2" float8, "units" varchar)
        RETURNS "pg_catalog"."float8" AS $BODY$
            DECLARE
                dist float = 0;
                radlat1 float;
                radlat2 float;
                theta float;
                radtheta float;
            BEGIN
                IF lat1 = lat2 OR lon1 = lon2
                    THEN RETURN dist;
                ELSE
                    radlat1 = pi() * lat1 / 180;
                    radlat2 = pi() * lat2 / 180;
                    theta = lon1 - lon2;
                    radtheta = pi() * theta / 180;
                    dist = sin(radlat1) * sin(radlat2) + cos(radlat1) * cos(radlat2) * cos(radtheta);

                    IF dist > 1 THEN dist = 1; END IF;

                    dist = acos(dist);
                    dist = dist * 180 / pi();
                    dist = dist * 60 * 1.1515;

                    IF units = 'K' THEN dist = dist * 1.609344; END IF;
                    IF units = 'N' THEN dist = dist * 0.8684; END IF;

                    RETURN dist;
                END IF;
            END;
        $BODY$
          	LANGUAGE plpgsql VOLATILE
          	COST 100;`;

  // return await models.sequelize.query(calculateDistanceFunction, { type: models.sequelize.QueryTypes.SELECT })
  return true;
}

module.exports = {
  CreateOrReplaceCalculateDistance
};
