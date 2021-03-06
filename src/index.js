/*
 * moleculer-db-connector-sequilize
 *
 * Based on moleculer-db-adapter-sequelize (Copyright (c) 2017 Ice Services
 * (https://github.com/ice-services/moleculer-db), MIT Licensed)
 *
 * Copyright (c) 2018 Dmitry Shevelev (https://github.com/igrave1988@gmail.com/moleculer-db-connector-sequilize)
 * MIT Licensed
 */

'use strict';
const _ 		= require("lodash"),
      Promise	= require("bluebird"),
      Sequelize = require("sequelize");

/* Constants with error message */
const errorModel = 'Missing `model` definition in schema of service!';


class SequelizeDbConnector {

	/**
	 * Creates an instance of SequelizeDbConnector.
	 * @param {any} opts
	 *
	 * @memberof SequelizeDbConnector
	 */
	constructor(...opts) {
    this.opts = opts;
  }

	/**
	 * Initialize adapter
	 *
	 * @param {ServiceBroker} broker
	 * @param {Service} service
	 *
	 * @memberof SequelizeDbConnector
	 */
	init(broker, service) {
		this.broker = broker;
		this.service = service;

		if (!this.service.schema.model) throw new Error(errorModel);
	}

	/**
	 * Connect to database
	 *
	 * @returns {Promise}
	 *
	 * @memberof SequelizeDbConnector
	 */
	connect() {
    /* Check in process connection to database. If it find - get this connection,
     * if not - create new sequilize object. */
    if (process.isCommonDb[process.pid]) {
      this.db = (process.dbCommonConnection[process.pid])
        ? process.dbCommonConnection[process.pid]
        : new Sequelize(...this.opts);

      if(!process.dbCommonConnection[process.pid]) process.dbCommonConnection[process.pid] = this.db;

    } else {
      this.db = new Sequelize(...this.opts);
    }


		return this.db.authenticate().then(() => {

			let m = this.service.schema.model;
      this.model = m(this.db);
			this.service.model = this.model;

			return this.model.sync();
		});
	}

	/**
	 * Disconnect from database
	 *
	 * @returns {Promise}
	 *
	 * @memberof SequelizeDbConnector
	 */
	disconnect() {
		if (this.db) this.db.close();
		return Promise.resolve();
	}

	/**
	 * Find all entities by filters.
	 *
	 * Available filter props:
	 * 	- limit
	 *  - offset
	 *  - sort
	 *  - search
	 *  - searchFields
	 *  - query
	 *
	 * @param {any} filters
	 * @returns {Promise}
	 *
	 * @memberof SequelizeDbConnector
	 */
	find(filters) {
		return this.createCursor(filters);
	}

	/**
	 * Find an entity by query
	 *
	 * @param {Object} query
	 * @returns {Promise}
	 * @memberof SequelizeDbConnector
	 */
	findOne(query) {
		return this.model.findOne(query);
	}

	/**
	 * Find an entities by ID
	 *
	 * @param {any} _id
	 * @returns {Promise}
	 *
	 * @memberof SequelizeDbConnector
	 */
	findById(_id) {
		return this.model.findById(_id);
	}

	/**
	 * Find any entities by IDs
	 *
	 * @param {Array} idList
	 * @returns {Promise}
	 *
	 * @memberof SequelizeDbConnector
	 */
	findByIds(idList) {
    /* Check length of ids list */
    const filter = (idList.length > 0 )
          ? { where: { id: idList }}
          : {};

		return this.model.findAll(filter);
	}

	/**
	 * Get count of filtered entites
	 *
	 * Available filter props:
	 *  - search
	 *  - searchFields
	 *  - query
	 *
	 * @param {Object} [filters={}]
	 * @returns {Promise}
	 *
	 * @memberof SequelizeDbConnector
	 */
	count(filters = {}) {
		return this.createCursor(filters, true);
	}

	/**
	 * Insert an entity
	 *
	 * @param {Object} entity
	 * @returns {Promise}
	 *
	 * @memberof SequelizeDbConnector
	 */
	insert(entity) {
		return this.model.create(entity);
	}

	/**
	 * Insert many entities
	 *
	 * @param {Array} entities
	 * @returns {Promise}
	 *
	 * @memberof SequelizeDbConnector
	 */
	insertMany(entities) {
		const p = entities.map((e) => this.model.create(e));
		return Promise.all(p);
	}

	/**
	 * Update many entities by `where` and `update`
	 *
	 * @param {Object} where
	 * @param {Object} update
	 * @returns {Promise}
	 *
	 * @memberof SequelizeDbConnector
	 */
	updateMany(where, update) {
		return this.model.update(update, { where }).then((res) => res[0]);
	}

	/**
	 * Update an entity by ID and `update`
	 *
	 * @param {any} _id
	 * @param {Object} update
	 * @returns {Promise}
	 *
	 * @memberof SequelizeDbConnector
	 */
	updateById(_id, update) {
		return this.findById(_id)
      .then((entity)=> {
			  return entity.update(update["$set"]);
		  });
	}

	/**
	 * Remove entities which are matched by `where`
	 *
	 * @param {Object} where
	 * @returns {Promise}
	 *
	 * @memberof SequelizeDbConnector
	 */
	removeMany(where) {
		return this.model.destroy({ where });
	}

	/**
	 * Remove an entity by ID
	 *
	 * @param {any} _id
	 * @returns {Promise}
	 *
	 * @memberof SequelizeDbConnector
	 */
	removeById(_id) {
		return this.findById(_id)
      .then((entity) => {
			  return entity.destroy().then(() => entity);
		  });
	}

	/**
	 * Clear all entities from collection
	 *
	 * @returns {Promise}
	 *
	 * @memberof SequelizeDbConnector
	 */
	clear() {
		return this.model.destroy({ where: {} });
	}

	/**
	 * Convert DB entity to JSON object
	 *
	 * @param {any} entity
	 * @returns {Object}
   *
	 * @memberof SequelizeDbConnector
	 */
	entityToObject(entity) {
		return entity.get({ plain: true });
	}

	/**
	 * Create a filtered query
	 * Available filters in `params`:
	 *  - search
	 * 	- sort
	 * 	- limit
	 * 	- offset
	 *  - query
	 *
 	 * @param {Object} params
 	 * @param {Boolean} isCounting
	 * @returns {Promise}
	 */
	createCursor(params, isCounting) {
		if (params) {
			const q = {
				where: params.query || {}
			};

			/* Text search  */
			if (_.isString(params.search) && params.search !== '') {
				let fields = [];
				if (params.searchFields) {
					fields = _.isString(params.searchFields) ? params.searchFields.split(' ') : params.searchFields;
				}

				q.where = {
					$or: fields.map((f) => {
						return { [f]: { $like: `%${params.search}%` }
						};
					})
				};
			}

			/* Sort */
			if (params.sort) {
				let sort = this.transformSort(params.sort);
				if (sort) q.order = sort;
			}

			/* Offset */
			if (_.isNumber(params.offset) && params.offset > 0) q.offset = params.offset;

			/* limit */
			if (_.isNumber(params.limit) && params.limit > 0) q.limit = params.limit;

			if (isCounting) return this.model.count(q);
			else return this.model.findAll(q);
		}

		if (isCounting) return this.model.count();
		else return this.model.findAll();
	}

	/**
	 * Convert the `sort` param to a `sort` object to Mongo queries.
	 *
	 * @param {String|Array<String>|Object} paramSort
	 * @returns {Object} Return with a sort object like `[["votes", "ASC"], ["title", "DESC"]]`
	 * @memberof SequelizeDbConnector
	 */
	transformSort(paramSort) {
		let sort = paramSort;


    if (_.isString(sort)) sort = sort.replace(/,/, ' ').split(' ');


		if (Array.isArray(sort)) {
			let sortObj = [];


			sort.forEach((s) => {
				if (s.startsWith("-")) sortObj.push([s.slice(1), "DESC"]);
				else sortObj.push([s, "ASC"]);
			});

			return sortObj;
		}


    if (_.isObject(sort)) return Object.keys(sort).map((name) => [name, sort[name] > 0 ? "ASC" : "DESC"]);

		/* istanbul ignore next*/
		return [];
	}


  /**
   * Raw queries for Sequilize
   * @param {String} query
   * @param {Object} object with options for raw query
   * @param {String} sequilize query type name
   *
   * @memberof SequelizeDbConnector
   */
  raw(query, options, type) {
    const uppercased = (type) ? type.toUpperCase() : 'SELECT';

    return this.db.query(query, options, Sequelize.QueryType[uppercased]);
  }


  /**
   * Get Sequilize object with connection
   *
   * @return {Object}
   *
   */
  getSequilize() {
    return this.db();
  }
}

module.exports = (common) => {
  if(!process.isCommonDb) process.isCommonDb = {};
  
  process.isCommonDb[process.pid]= (common && typeof common === 'boolean') ? common : false;
  if(process.isCommonDb[process.pid] && !process.dbCommonConnection) process.dbCommonConnection = {}; 

  return SequelizeDbAdapter;
};
