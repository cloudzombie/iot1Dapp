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
		accountId: new Buffer(data.accountId, 'utf8').toString('hex'), // Save as hex string
		deviceId: new Buffer(data.deviceId, 'utf8').toString('hex'), 
		deviceName: new Buffer(data.deviceName, 'utf8').toString('hex')
	};

	return trs;
}

Home.prototype.calculateFee = function (trs) {
    return 0; // Free!
}

Home.prototype.verify = function (trs, sender, cb, scope) {
	/*if (trs.asset.deviceId.length > 40) {
		return setImmediate(cb, "Max length of an device id is 20 characters!");
	}
	if (trs.asset.deviceName.length > 100) {
		return setImmediate(cb, "Max length of an device name is 50 characters!");
	}*/

	setImmediate(cb, null, trs);
}

Home.prototype.getBytes = function (trs) {
	return new Buffer(trs.asset.accountId, 'hex');
	return new Buffer(trs.asset.deviceId, 'hex');
	return new Buffer(trs.asset.deviceName, 'hex');
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
		table: "asset_devices",
		values: {
			transactionId: trs.id,
			accountId: trs.asset.accountId,
			deviceId: trs.asset.deviceId,
			deviceName: trs.asset.deviceName
		}
	}, cb);
}

Home.prototype.dbRead = function (row) {
	if (!row.gb_transactionId) {
		return null;
	} else {
		return {
			accountId: row.hd_accountId,
			deviceId: row.hd_deviceId,
			deviceName: row.hd_deviceName
		};
	}
}

Home.prototype.normalize = function (asset, cb) {
	library.validator.validate(asset, {
		type: "object", // It is an object
		properties: {
			accountId: { // It contains a deviceId property
				type: "string", // It is a string
				format: "hex", // It is in a hexadecimal format
				minLength: 1 // Minimum length of string is 1 character
			},
			deviceId: { // It contains a deviceId property
				type: "string", // It is a string
				format: "hex", // It is in a hexadecimal format
				minLength: 1 // Minimum length of string is 1 character
			},
			deviceName: { // It contains a deviceName property
				type: "string", // It is a string
				format: "hex", // It is in a hexadecimal format
				minLength: 1 // Minimum length of string is 1 character
			}
		},
		required: ["accountId", "deviceId", "deviceName"] // deviceId&deviceName property is required and must be defined
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
					accountId: query.accountId,
					deviceId: query.deviceId,
					deviceName: query.deviceName,
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
                maxLength: 42
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
                alias: "hd",
                on: {"t.id": "hd.transactionId"}
            }]
        }, ['id', 'type', 'senderId', 'senderPublicKey', 'amount', 'fee', 'signature', 'blockId', 'transactionId', 'accountId', 'deviceId', 'deviceName'], function (err, transactions) {
            if (err) {
                return cb(err.toString());
            }

            // Map results to asset object
            var devices = transactions.map(function (tx) {
                tx.asset = {
                    deviceId: new Buffer(tx.deviceId, 'hex').toString('utf8'),
                    deviceName: new Buffer(tx.deviceName, 'hex').toString('utf8')
                };

                delete tx.deviceId;
                delete tx.deviceName;
                return tx;
            });

            return cb(null, {
                devices: devices
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
                maxLength: 42
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
                alias: "hf",
                on: {"t.id": "hf.transactionId"}
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
                    deviceName: new Buffer(tx.deviceName, 'hex').toString('utf8')
                };

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
