var private = {}, self = null,
	library = null, modules = null;

function Home(cb, _library) {
	self = this;
	self.type = 6
	library = _library;
	cb(null, self);
}

Home.prototype.create = function (data, trs) {
	trs.recipientId = data.recipientId;
	trs.asset = {
		entry: new Buffer(data.entry, 'utf8').toString('hex') // Save entry as hex string
	};

	return trs;
}

Home.prototype.calculateFee = function (trs) {
    return 0; // Free!
}

Home.prototype.verify = function (trs, sender, cb, scope) {
	if (trs.asset.entry.length > 2000) {
		return setImmediate(cb, "Max length of an entry is 1000 characters!");
	}

	setImmediate(cb, null, trs);
}

Home.prototype.getBytes = function (trs) {
	return new Buffer(trs.asset.entry, 'hex');
}

Home.prototype.apply = function (trs, sender, cb, scope) {
    modules.blockchain.accounts.mergeAccountAndGet({
        address: sender.address,
        balance: -trs.fee
    }, cb);
}

Home.prototype.undo = function (trs, sender, cb, scope) {
    modules.blockchain.accounts.undoMerging({
        address: sender.address,
        balance: -trs.fee
    }, cb);
}

Home.prototype.applyUnconfirmed = function (trs, sender, cb, scope) {
    if (sender.u_balance < trs.fee) {
        return setImmediate(cb, "Sender doesn't have enough coins");
    }

    modules.blockchain.accounts.mergeAccountAndGet({
        address: sender.address,
        u_balance: -trs.fee
    }, cb);
}

Home.prototype.undoUnconfirmed = function (trs, sender, cb, scope) {
    modules.blockchain.accounts.undoMerging({
        address: sender.address,
        u_balance: -trs.fee
    }, cb);
}

Home.prototype.ready = function (trs, sender, cb, scope) {
	setImmediate(cb);
}

Home.prototype.save = function (trs, cb) {
	modules.api.sql.insert({
		table: "asset_entries",
		values: {
			transactionId: trs.id,
			entry: trs.asset.entry
		}
	}, cb);
}

Home.prototype.dbRead = function (row) {
	if (!row.gb_transactionId) {
		return null;
	} else {
		return {
			entry: row.gb_entry
		};
	}
}

Home.prototype.normalize = function (asset, cb) {
	library.validator.validate(asset, {
		type: "object", // It is an object
		properties: {
			entry: { // It contains a entry property
				type: "string", // It is a string
				format: "hex", // It is in a hexadecimal format
				minLength: 1 // Minimum length of string is 1 character
			}
		},
		required: ["entry"] // Entry property is required and must be defined
	}, cb);
}

Home.prototype.onBind = function (_modules) {
	modules = _modules;
	modules.logic.transaction.attachAssetType(self.type, self);
}

Home.prototype.putDevice = function (cb, query) {
	library.validator.validate(query, {
		type: "object",
		properties: {
			accountId: {
				type: "string",
				minLength: 1,
				maxLength: 21
			},
			secret: {
				type: "string",
				minLength: 1,
				maxLength: 100
			},
			deviceId: {
				type: "string",
				minLength: 1,
				maxLength: 20
			},
			deviceName: {
				type: "string",
				minLength: 1,
				maxLength: 50
			}
		}
	}, function (err) {
		// If error exists, execute callback with error as first argument
		if (err) {
			return cb(err[0].message);
		}

		var keypair = modules.api.crypto.keypair(query.secret);

		modules.blockchain.accounts.setAccountAndGet({
			publicKey: keypair.publicKey.toString('hex')
		}, function (err, account) {
			// If error occurs, call cb with error argument
			if (err) {
				return cb(err);
			}

			console.log(account);
			try {
				var transaction = library.modules.logic.transaction.create({
					type: self.type,
					deviceId: query.deviceId,
					deviceName: query.deviceName,
					accountId: query.accountId,
					sender: account,
					keypair: keypair
				});
			} catch (e) {
				// Catch error if something goes wrong
				return setImmediate(cb, e.toString());
			}

			// Send transaction for processing
			modules.blockchain.transactions.processUnconfirmedTransaction(transaction, cb);
		});
	});
}

Home.prototype.putFunction = function (cb, query) {
	library.validator.validate(query, {
		type: "object",
		properties: {
			accountId: {
				type: "string",
				minLength: 1,
				maxLength: 21
			},
			secret: {
				type: "string",
				minLength: 1,
				maxLength: 100
			},
			deviceId: {
				type: "string",
				minLength: 1,
				maxLength: 20
			},
			functionId: {
				type: "string",
				minLength: 1,
				maxLength: 20
			},
			functionName: {
				type: "string",
				minLength: 1,
				maxLength: 50
			}
		}
	}, function (err) {
		// If error exists, execute callback with error as first argument
		if (err) {
			return cb(err[0].message);
		}

		var keypair = modules.api.crypto.keypair(query.secret);

		modules.blockchain.accounts.setAccountAndGet({
			publicKey: keypair.publicKey.toString('hex')
		}, function (err, account) {
			// If error occurs, call cb with error argument
			if (err) {
				return cb(err);
			}

			console.log(account);
			try {
				var transaction = library.modules.logic.transaction.create({
					type: self.type,
					functionId: query.functionId,
					deviceId: query.deviceId,
					functionName: query.functionName,
					accountId: query.accountId,
					sender: account,
					keypair: keypair
				});
			} catch (e) {
				// Catch error if something goes wrong
				return setImmediate(cb, e.toString());
			}

			// Send transaction for processing
			modules.blockchain.transactions.processUnconfirmedTransaction(transaction, cb);
		});
	});
}

Home.prototype.getDevices = function (cb, query) {
    // Verify query parameters
    library.validator.validate(query, {
        type: "object",
        properties: {
            accountId: {
                type: "string",
                minLength: 1,
                maxLength: 21
            }
        },
        required: ["accountId"]
    }, function (err) {
        if (err) {
            return cb(err[0].message);
        }

        // Select from transactions table and join entries from the asset_entries table
        modules.api.sql.select({
            table: "transactions",
            alias: "t",
            condition: {
                accountId: query.accountId,
                type: self.type
            },
            join: [{
                type: 'left outer',
                table: 'asset_devices',
                alias: "h",
                on: {"t.id": "h.transactionId"}
            }]
        }, ['id', 'type', 'senderId', 'senderPublicKey', 'accountId', 'amount', 'fee', 'signature', 'blockId', 'transactionId', 'deviceId', 'deviceName'], function (err, transactions) {
            if (err) {
                return cb(err.toString());
            }

            // Map results to asset object
            var entries = transactions.map(function (tx) {
                tx.asset = {
                    deviceId: new Buffer(tx.deviceId, 'hex').toString('utf8'),
                    deviceName: new Buffer(tx.deviceName, 'hex').toString('utf8')                };

                delete tx.deviceId;
                delete tx.deviceName;
                return tx;
            });

            return cb(null, {
                deviceId: deviceId,
                deviceName: deviceName
            })
        });
    });
}

Home.prototype.getFunctions = function (cb, query) {
    // Verify query parameters
    library.validator.validate(query, {
        type: "object",
        properties: {
            accountId: {
                type: "string",
                minLength: 1,
                maxLength: 21
            }
        },
        required: ["accountId"]
    }, function (err) {
        if (err) {
            return cb(err[0].message);
        }

        // Select from transactions table and join entries from the asset_entries table
        modules.api.sql.select({
            table: "transactions",
            alias: "t",
            condition: {
                accountId: query.accountId,
                type: self.type
            },
            join: [{
                type: 'left outer',
                table: 'asset_functions',
                alias: "h",
                on: {"t.id": "h.transactionId"}
            }]
        }, ['id', 'type', 'senderId', 'senderPublicKey', 'accountId', 'amount', 'fee', 'signature', 'blockId', 'transactionId', 'deviceId', 'functionId', 'deviceName'], function (err, transactions) {
            if (err) {
                return cb(err.toString());
            }

            // Map results to asset object
            var entries = transactions.map(function (tx) {
                tx.asset = {
                    deviceId: new Buffer(tx.deviceId, 'hex').toString('utf8'),
                    functionId: new Buffer(tx.functionId, 'hex').toString('utf8'),
                    deviceName: new Buffer(tx.deviceName, 'hex').toString('utf8')                };

                delete tx.deviceId;
                delete tx.functionId;
                delete tx.deviceName;
                return tx;
            });

            return cb(null, {
                deviceId: deviceId,
                functionId: functionId,
                deviceName: deviceName
            })
        });
    });
}

module.exports = Home;
