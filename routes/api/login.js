const express = require('express');
const jwt = require('jsonwebtoken');
const keys = require('../../config/keys');
const axios = require('axios');
const FB = require("fb");
const googleLoginUrl = 'https://www.googleapis.com/oauth2/v1';
const router = express.Router();
const models = require('../../db/models');

// login by google 
router.post('/login-google', async (req, res) => {
    const {
        token,
        google_name
    } = req.body;
    if (!token) return res.status(422).json({
        success: false,
        errors: 'Error, Failed to login.'
    });

    return axios
        .get(`${googleLoginUrl}/tokeninfo?access_token=${token}`)
        .then(async resp => {
            const userResponse = resp.data;
            if (!userResponse) return res.status(400).json({
                status: false,
                errors: `Fail to login`
            });

            const { email } = userResponse;

            const userData = await models.User.findOne({
                where: {
                    email
                }
            });
            
            if (!userData) {
                return res.status(401).json({
                    success: false,
                    errors: `User not registered`,
                    email: email,
                    name: google_name
                });
            }

            let userType = '';

            if (userData.type === 0 && userData.companyType === 0) {
                userType = 'Member';
            } else if (userData.type === 0 && userData.companyType === 1) {
                userType = 'Company';
            } else if (userData.type === 1) {
                userType = 'Dealer';
            }

            const payload = {
                id: userData.id
            };
            return jwt.sign(payload, keys.secretKey, { expiresIn: 8 * 3600 }, (err, token) => {
                if (err) {
                  errors.jwt = 'Something wrong with JWT signing';
                  return res.status(404).json(errors);
                }
            
                return res.json({
                    success: true,
                    token: `Bearer ${token}`,
                    userType
                });
            });
        })
        .catch(err => {
            console.log(err);
            res.status(400).json({
                success: false,
                errors: `Sistem failure`,
                backend: err.body
            });
        });
});

// login by fb 
router.post('/login-fb', async (req, res) =>{
    const {token } = req.body;
    if (!token) return res.status(422).json({
        success: false,
        errors: 'Error, Failed to login.'
    });

    FB.api(
        "me",
        {
          fields: ["id", "name", "address", "birthday", "email", "gender", "picture"],
          access_token: token
        },
        async FBdata => {
            if(FBdata && FBdata.error ){
                if (FBdata.error.code === "ETIMEDOUT") return res.status(400).json({ success: false, errors: 'Request timeout!' });
                return res.status(400).json({
                    success: false,
                    errors: FBdata.error.message
                });
            }

            const userdata = await models.User.findOne({
                where: { email: FBdata.email }
            });

            if(!userdata){
                return res.status(401).json({
                    success: false,
                    errors: `User not registered`,
                    email: FBdata.email,
                    name: FBdata.name
                });
            }

            let userType = '';

            if (userdata.type === 0 && userdata.companyType === 0) {
                userType = 'Member';
            } else if (userdata.type === 0 && userdata.companyType === 1) {
                userType = 'Company';
            } else if (userdata.type === 1) {
                userType = 'Dealer';
            }

            const payload = {
                id: userdata.id
            };

            return jwt.sign(payload, keys.secretKey, { expiresIn: 8 * 3600 }, (err, token) => {
                if (err) {
                  errors.jwt = 'Something wrong with JWT signing';
                  return res.status(404).json(errors);
                }
            
                return res.json({
                    success: true,
                    token: `Bearer ${token}`,
                    userType
                });
            });
        }
    );
});
module.exports = router;