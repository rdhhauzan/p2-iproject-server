const { comparePassword } = require("../helpers/bcrypt");
const { createToken } = require("../helpers/jwt");
const { User, Comment, Post } = require("../models/index");
const axios = require("axios");
const { JSDOM } = require("jsdom");
const { Readability } = require("@mozilla/readability");
const midtransClient = require("midtrans-client");

class Controller {
  static async registerUser(req, res) {
    let { email, username, password } = req.body;
    // console.log(req.body);
    try {
      let data = await User.create({
        email: email,
        username: username,
        password: password,
      });

      res.status(201).json({
        id: data.id,
        email: data.email,
        username: data.username,
      });
    } catch (error) {
      if (
        error.name === "SequelizeValidationError" ||
        error.name === "SequelizeUniqueConstraintError"
      ) {
        error.errors.map((el) => {
          res.status(401).json({ message: el.message });
        });
      }
    }
  }

  static async loginUser(req, res) {
    let { email, password } = req.body;
    // console.log(req.body);
    try {
      let findUser = await User.findOne({
        where: {
          email: email,
        },
      });
      if (!findUser) {
        throw { name: "USER_NOT_FOUND" };
      }

      let validatePassword = comparePassword(password, findUser.password);
      if (!validatePassword) {
        throw { name: "USER_NOT_FOUND" };
      }

      const payload = {
        id: findUser.id,
        email: findUser.email,
        username: findUser.username,
        isPremium: findUser.isPremium,
      };

      const access_token = createToken(payload);
      res.status(200).json({
        access_token: access_token,
        id: findUser.id,
        email: findUser.email,
        username: findUser.username,
        isPremium: findUser.isPremium,
      });
    } catch (error) {
      if (error.name === "USER_NOT_FOUND") {
        res.status(401).json({
          message: "Invalid Email/Password",
        });
      }
    }
  }

  static async fetchDataFromApi(req, res) {
    let { page } = req.query;
    try {
      let { data } = await axios.get(
        `https://www.newsapi.ai/api/v1/article/getArticles?query=%7B%22%24query%22%3A%7B%22%24and%22%3A%5B%7B%22locationUri%22%3A%22http%3A%2F%2Fen.wikipedia.org%2Fwiki%2FIndonesia%22%7D%2C%7B%22dateStart%22%3A%222022-11-05%22%2C%22dateEnd%22%3A%222022-11-09%22%2C%22lang%22%3A%22ind%22%7D%5D%7D%2C%22%24filter%22%3A%7B%22dataType%22%3A%5B%22news%22%5D%7D%7D&resultType=articles&articlesSortBy=date&articlesCount=20&articleBodyLen=-1&apiKey=1ac04d32-99c0-4172-a7d0-c2b7b1988e95&articlesPage=${page}`
      );
      res.status(200).json(data);
    } catch (error) {
      console.log(error);
    }
  }

  static async searchNews(req, res) {
    // let { search } = req.body;
    let { page, search } = req.query;
    const options = {
      method: "GET",
      url: "https://newscatcher.p.rapidapi.com/v1/search_enterprise",
      params: {
        q: `${search}`,
        lang: "id",
        sort_by: "relevancy",
        page: `${page}`,
        media: "True",
        page_size: "20",
      },
      headers: {
        "X-RapidAPI-Key": "832bfe4441msha6c9d57ff9ea7f5p1087cfjsn9563c7304789",
        "X-RapidAPI-Host": "newscatcher.p.rapidapi.com",
      },
    };

    axios
      .request(options)
      .then(function (response) {
        // console.log(response.data);
        res.status(200).json(response.data);
      })
      .catch(function (error) {
        console.error(error);
      });
  }

  static async userPayment(req, res) {
    // Create Snap API instance
    let snap = new midtransClient.Snap({
      // Set to true if you want Production Environment (accept real transaction).
      isProduction: false,
      serverKey: "SB-Mid-server-nU1WKAwolq2Zzv-eKVov7L65",
    });

    let parameter = {
      transaction_details: {
        order_id: "YOUR-ORDERID-" + Math.floor(Math.random() * 500000),
        gross_amount: 3000,
      },
      credit_card: {
        secure: true,
      },
      customer_details: {
        email: req.user.email,
      },
    };

    snap.createTransaction(parameter).then((transaction) => {
      // transaction token
      let transactionToken = transaction.token;
      let transactionUrl = transaction.redirect_url;
      // console.log("transactionToken:", transactionToken);
      res.status(200).json({
        transactionToken: transactionToken,
        redirect_url: transactionUrl,
      });
    });
    // res.redirect(200, transactionUrl);
  }

  static async addPost(req, res) {
    console.log(req.user);
    let { title, content, imageUrl, tag } = req.body;
    try {
      if (!title || !content || !imageUrl || !tag) {
        throw { name: "DATA_NOT_COMPLETE" };
      }
      let data = await Post.create({
        title: title,
        content: content,
        imageUrl: imageUrl,
        tag: tag,
        UserId: req.user.id,
      });

      // res.status(201).json(data)
      res.status(201).json({ message: "Post Add Successfully!" });
    } catch (error) {
      if (error.name === "DATA_NOT_COMPLETE") {
        res.status(403).json({ message: "Please Fill All the Fields!" });
      }
      console.log(error);
    }
  }

  static async editPost(req, res) {
    // console.log('aaaaaa');
    let { title, content, imageUrl, tag } = req.body;
    let PostId = req.params.id;
    try {
      if (!title || !content || !imageUrl || !tag) {
        throw { name: "DATA_NOT_COMPLETE" };
      }
      let data = await Post.update(
        {
          title: title,
          content: content,
          imageUrl: imageUrl,
          tag: tag,
          UserId: req.user.id,
        },
        {
          where: {
            id: PostId,
          },
        }
      );

      // res.status(201).json(data)
      res.status(201).json({ message: "Post Edit Successfully!" });
    } catch (error) {
      if (error.name === "DATA_NOT_COMPLETE") {
        res.status(403).json({ message: "Please Fill All the Fields!" });
      }
      console.log(error);
    }
  }

  static async commentPost(req, res) {
    let PostId = req.params.postId;
    let { comment } = req.body;
    try {
      let data = await Comment.create({
        UserId: req.user.id,
        PostId: PostId,
        comment: comment,
      });

      res.status(201).json({
        message: "Comment Add Successfully",
      });
    } catch (error) {}
  }

  static async fetchNewsFromDB(req, res) {
    const query = {};
    let limit = 20;
    let offset;
    const getPagingData = (data, page, limit) => {
      const { count: totalItems, rows: rows } = data;
      // console.log(data);
      const currentPage = page ? +page : 0;
      const totalPages = Math.ceil(totalItems / limit);

      return { totalItems, rows, totalPages, currentPage };
    };

    const { page } = req.query;
    if (page !== "" && typeof page !== "undefined") {
      offset = page * limit - limit;
      query.offset = offset;
      query.limit = limit;
    } else {
      limit = 20;
      offset = 0;
      query.limit = limit;
      query.offset = offset;
    }

    query.include = [
      {
        model: Comment,
        include: {
          model: User,
        },
      },
    ];

    try {
      let data = await Post.findAndCountAll(query);

      res.status(200).json(getPagingData(data, page, limit));
    } catch (error) {
      console.log(error);
    }
  }

  static async getUserPost(req, res) {
    const query = {};
    let limit = 20;
    let offset;
    const getPagingData = (data, page, limit) => {
      const { count: totalItems, rows: rows } = data;
      // console.log(data);
      const currentPage = page ? +page : 0;
      const totalPages = Math.ceil(totalItems / limit);

      return { totalItems, rows, totalPages, currentPage };
    };

    const { page } = req.query;
    if (page !== "" && typeof page !== "undefined") {
      offset = page * limit - limit;
      query.offset = offset;
      query.limit = limit;
    } else {
      limit = 20;
      offset = 0;
      query.limit = limit;
      query.offset = offset;
    }

    query.where = {
      UserId: req.user.id,
    };
    try {
      let data = await Post.findAndCountAll(query);

      res.status(200).json(getPagingData(data, page, limit));
    } catch (error) {
      console.log(error);
    }
  }

  static async getNewsById(req, res) {
    let { id } = req.params;
    try {
      let data = await Post.findByPk(id, {
        include: [
          {
            model: Comment,
            include: {
              model: User,
            },
          },
          {
            model: User,
          },
        ],
      });

      res.status(200).json(data);
    } catch (error) {}
  }

  static async deletePost(req, res) {
    let { postId } = req.params;
    try {
      await Post.destroy({
        where: {
          UserId: req.user.id,
          id: postId,
        },
      });

      res.status(200).json({
        message: "Post Delete Successfully!"
      })
    } catch (error) {
      console.log(error);
    }
  }

  static async userUpdateStatus (req, res) {
    try {
      await User.update(
        { isPremium: true },
        {
          where: {
            id: req.user.id,
          },
        }
      );
    } catch (error) {
      console.log(error);
    }
  }
}

module.exports = Controller;
