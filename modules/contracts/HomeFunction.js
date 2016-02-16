var private = {}, self = null,
	library = null, modules = null;

function HomeFunction(cb, _library) {
	self = this;
	self.type = 6;
	library = _library;
	cb(null, self);
}

HomeFunction.prototype.create = function (data, trs) {
	trs.recipientId = data.recipientId;
	trs.asset = {
		accountId2: new Buffer(data.accountId2, 'utf8').toString('hex'), // Save as hex string
		deviceId2: new Buffer(data.deviceId2, 'utf8').toString('hex'), 
		functionId2: new Buffer(data.functionId2, 'utf8').toString('hex'),
		functionName2: new Buffer(data.functionName2, 'utf8').toString('hex')
	};

	return trs;
}

HomeFunction.prototype.calculateFee = function (trs) {
    return 0; // Free!
}

HomeFunction.prototype.verify = function (trs, sender, cb, scope) {
	/*if (trs.asset.deviceId2.length > 40) {
		return setImmediate(cb, "Max length of an device id is 20 characters!");
	}
	if (trs.asset.deviceName.length > 100) {
		return setImmediate(cb, "Max length of an device name is 50 characters!");
	}*/

	setImmediate(cb, null, trs);
}

HomeFunction.prototype.getBytes = function (trs) {
	return new Buffer(trs.asset.accountId2, 'hex');
	return new Buffer(trs.asset.deviceId2, 'hex');
	return new Buffer(trs.asset.functionId2, 'hex');
	return new Buffer(trs.asset.functionName2, 'hex');
}

HomeFunction.prototype.apply = function (trs, sender, cb, scope) {
    modules.blockchain.accounts.mergeAccountAndGet({
        address: sender.address,
        balance: -trs.fee
    }, cb);
}

HomeFunction.prototype.undo = function (trs, sender, cb, scope) {
    modules.blockchain.accounts.undoMerging({
        address: sender.address,
        balance: -trs.fee
    }, cb);
}

HomeFunction.prototype.applyUnconfirmed = function (trs, sender, cb, scope) {
    if (sender.u_balance < trs.fee) {
        return setImmediate(cb, "Sender doesn't have enough coins");
    }

    modules.blockchain.accounts.mergeAccountAndGet({
        address: sender.address,
        u_balance: -trs.fee
    }, cb);
}

HomeFunction.prototype.undoUnconfirmed = function (trs, sender, cb, scope) {
    modules.blockchain.accounts.undoMerging({
        address: sender.address,
        u_balance: -trs.fee
    }, cb);
}

HomeFunction.prototype.ready = function (trs, sender, cb, scope) {
	setImmediate(cb);
}

HomeFunction.prototype.save = function (trs, cb) {
	modules.api.sql.insert({
		table: "asset_functions",
		values: {
			transactionId: trs.id,
			accountId2: trs.asset.accountId2,
			deviceId2: trs.asset.deviceId2,
			functionId2: trs.asset.functionId2,
			functionName2: trs.asset.functionName2
		}
	}, cb);
}

HomeFunction.prototype.dbRead = function (row) {
	if (!row.hf_transactionId) {
		return null;
	} else {
		return {
			accountId2: row.hf_accountId2,
			deviceId2: row.hf_deviceId2,
			functionId2: row.hf_functionId2,
			functionName2: row.hf_functionName2
		};
	}
}

HomeFunction.prototype.normalize = function (asset, cb) {
	library.validator.validate(asset, {
		type: "object", // It is an object
		properties: {
			accountId2: { // It contains a deviceId2 property
				type: "string", // It is a string
				format: "hex", // It is in a hexadecimal format
				minLength: 1 // Minimum length of string is 1 character
			},
			deviceId2: { // It contains a deviceId2 property
				type: "string", // It is a string
				format: "hex", // It is in a hexadecimal format
				minLength: 1 // Minimum length of string is 1 character
			},
			functionId2: { // It contains a functionId2 property
				type: "string", // It is a string
				format: "hex", // It is in a hexadecimal format
				minLength: 1 // Minimum length of string is 1 character
			},
			functionName2: { // It contains a functionName2 property
				type: "string", // It is a string
				format: "hex", // It is in a hexadecimal format
				minLength: 1 // Minimum length of string is 1 character
			}
		},
		required: ["accountId2", "deviceId2", "functionId2", "functionName2"]
	}, cb);
}

HomeFunction.prototype.onBind = function (_modules) {
	modules = _modules;
	modules.logic.transaction.attachAssetType(self.type, self);
}

HomeFunction.prototype.putFunction = function (cb, query) {
	library.validator.validate(query, {
		type: "object",
		properties: {
			accountId2: {
				type: "string",
				minLength: 1,
				maxLength: 21
			},
			secret: {
				type: "string",
				minLength: 1,
				maxLength: 100
			},
			deviceId2: {
				type: "string",
				minLength: 1,
				maxLength: 20
			},
			functionId2: {
				type: "string",
				minLength: 1,
				maxLength: 20
			},
			functionName2: {
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
					accountId2: query.accountId2,
					deviceId2: query.deviceId2,
					functionId2: query.functionId2,
					functionName2: query.functionName2,
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

HomeFunction.prototype.getFunctions = function (cb, query) {
    // Verify query parameters
    library.validator.validate(query, {
        type: "object",
        properties: {
            accountId2: {
                type: "string",
                minLength: 1
            }
        },
        required: ["accountId2"]
    }, function (err) {
        if (err) {
            return cb(err[0].message);
        }

        // Select from transactions table and join entries from the asset_entries table
        modules.api.sql.select({
            table: "transactions",
            alias: "t",
            condition: {
                accountId2: query.accountId2,
                type: self.type
            },
            join: [{
                type: 'left outer',
                table: 'asset_functions',
                alias: "hf",
                on: {"t.id": "hf.transactionId"}
            }] // The fields have to be in the same order as in the blockchain.json
        }, ['id', 'type', 'senderId', 'senderPublicKey', 'recipientId', 'amount', 'fee', 'signature', 'blockId', 'transactionId', 'accountId2', 'deviceId2', 'functionId2', 'functionName2'], function (err, transactions) {
            if (err) {
                return cb(err.toString());
            }

            // Map results to asset object
            var functions = transactions.map(function (tx) { 
                tx.asset = {
                	accountId2: new Buffer(tx.accountId2, 'hex').toString('utf8'),
                    deviceId2: new Buffer(tx.deviceId2, 'hex').toString('utf8'),
                    functionId2: new Buffer(tx.functionId2, 'hex').toString('utf8'),
                    functionName2: new Buffer(tx.functionName2, 'hex').toString('utf8')
                };

                delete tx.accountId2;
                delete tx.deviceId2;
                delete tx.functionId2;
                delete tx.functionName2;
                return tx;
            });

            return cb(null, {
                functions: functions
            })
        });
    });
}

module.exports = HomeFunction;
