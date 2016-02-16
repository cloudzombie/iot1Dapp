var private = {}, self = null,
	library = null, modules = null;

function HomeFunction(cb, _library) {
	self = this;
	self.type = 6;
	library = _library;
	cb(null, self);
}

HomeFunction.prototype.create = function (data, trs2) {
	trs2.recipientId = data.recipientId;
	trs2.asset2 = {
		accountId: new Buffer(data.accountId, 'utf8').toString('hex'), // Save as hex string
		deviceId: new Buffer(data.deviceId, 'utf8').toString('hex'), 
		functionId: new Buffer(data.functionId, 'utf8').toString('hex'),
		functionName: new Buffer(data.functionName, 'utf8').toString('hex')
	};

	return trs2;
}

HomeFunction.prototype.calculateFee = function (trs2) {
    return 0; // Free!
}

HomeFunction.prototype.verify = function (trs2, sender, cb, scope) {
	/*if (trs2.asset2.deviceId.length > 40) {
		return setImmediate(cb, "Max length of an device id is 20 characters!");
	}
	if (trs2.asset2.deviceName.length > 100) {
		return setImmediate(cb, "Max length of an device name is 50 characters!");
	}*/

	setImmediate(cb, null, trs2);
}

HomeFunction.prototype.getBytes = function (trs2) {
	return new Buffer(trs2.asset2.accountId, 'hex');
	return new Buffer(trs2.asset2.deviceId, 'hex');
	return new Buffer(trs2.asset2.functionId, 'hex');
	return new Buffer(trs2.asset2.functionName, 'hex');
}

HomeFunction.prototype.apply = function (trs2, sender, cb, scope) {
    modules.blockchain.accounts.mergeAccountAndGet({
        address: sender.address,
        balance: -trs2.fee
    }, cb);
}

HomeFunction.prototype.undo = function (trs2, sender, cb, scope) {
    modules.blockchain.accounts.undoMerging({
        address: sender.address,
        balance: -trs2.fee
    }, cb);
}

HomeFunction.prototype.applyUnconfirmed = function (trs2, sender, cb, scope) {
    if (sender.u_balance < trs2.fee) {
        return setImmediate(cb, "Sender doesn't have enough coins");
    }

    modules.blockchain.accounts.mergeAccountAndGet({
        address: sender.address,
        u_balance: -trs2.fee
    }, cb);
}

HomeFunction.prototype.undoUnconfirmed = function (trs2, sender, cb, scope) {
    modules.blockchain.accounts.undoMerging({
        address: sender.address,
        u_balance: -trs2.fee
    }, cb);
}

HomeFunction.prototype.ready = function (trs2, sender, cb, scope) {
	setImmediate(cb);
}

HomeFunction.prototype.save = function (trs2, cb) {
	modules.api.sql.insert({
		table: "asset_functions",
		values: {
			transactionId: trs2.id,
			accountId: trs2.asset2.accountId,
			deviceId: trs2.asset2.deviceId,
			functionId: trs2.asset2.functionId,
			functionName: trs2.asset2.functionName
		}
	}, cb);
}

HomeFunction.prototype.dbRead = function (row) {
	if (!row.hf_transactionId) {
		return null;
	} else {
		return {
			accountId: row.hf_accountId,
			deviceId: row.hf_deviceId,
			functionId: row.hf_functionId,
			functionName: row.hf_functionName
		};
	}
}

HomeFunction.prototype.normalize = function (asset2, cb) {
	library.validator.validate(asset2, {
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
			functionId: { // It contains a functionId property
				type: "string", // It is a string
				format: "hex", // It is in a hexadecimal format
				minLength: 1 // Minimum length of string is 1 character
			},
			functionName: { // It contains a functionName property
				type: "string", // It is a string
				format: "hex", // It is in a hexadecimal format
				minLength: 1 // Minimum length of string is 1 character
			}
		},
		required: ["accountId", "deviceId", "functionId", "functionName"]
	}, cb);
}

HomeFunction.prototype.onBind = function (_modules) {
	modules = _modules;
	modules.logic.transaction.attachAsset2Type(self.type, self);
}

HomeFunction.prototype.putFunction = function (cb, query) {
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
					accountId: query.accountId,
					deviceId: query.deviceId,
					functionId: query.functionId,
					functionName: query.functionName,
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
            accountId: {
                type: "string",
                minLength: 1
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
            }] // The fields have to be in the same order as in the blockchain.json
        }, ['id', 'type', 'senderId', 'senderPublicKey', 'recipientId', 'amount', 'fee', 'signature', 'blockId', 'transactionId', 'accountId', 'deviceId', 'functionId', 'functionName'], function (err, transactions) {
            if (err) {
                return cb(err.toString());
            }

            // Map results to asset2 object
            var functions = transactions.map(function (tx) { 
                tx.asset2 = {
                	accountId: new Buffer(tx.accountId, 'hex').toString('utf8'),
                    deviceId: new Buffer(tx.deviceId, 'hex').toString('utf8'),
                    functionId: new Buffer(tx.functionId, 'hex').toString('utf8'),
                    functionName: new Buffer(tx.functionName, 'hex').toString('utf8')
                };

                delete tx.accountId;
                delete tx.deviceId;
                delete tx.functionId;
                delete tx.functionName;
                return tx;
            });

            return cb(null, {
                functions: functions
            })
        });
    });
}

module.exports = HomeFunction;
