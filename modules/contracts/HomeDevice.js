var private = {}, self = null,
	library = null, modules = null;

function HomeDevice(cb, _library) {
	self = this;
	self.type = 6
	library = _library;
	cb(null, self);
}

HomeDevice.prototype.create = function (data, trs) {
	trs.asset = {
		devices: {
			data: data.data
		}
	};

	trs.recipientId = data.recipientId;
	trs.asset.devices = {
		accountId: new Buffer(data.accountId, 'utf8').toString('hex'), // Save as hex string
		deviceId: new Buffer(data.deviceId, 'utf8').toString('hex'), 
		deviceName: new Buffer(data.deviceName, 'utf8').toString('hex')
	};

	return trs;
}

HomeDevice.prototype.calculateFee = function (trs) {
    return 0; // Free!
}

HomeDevice.prototype.verify = function (trs, sender, cb, scope) {
	/*if (trs.asset.devices.deviceId.length > 40) {
		return setImmediate(cb, "Max length of an device id is 20 characters!");
	}
	if (trs.asset.devices.deviceName.length > 100) {
		return setImmediate(cb, "Max length of an device name is 50 characters!");
	}*/

	setImmediate(cb, null, trs);
}

HomeDevice.prototype.getBytes = function (trs) {
	var b = Buffer.concat([new Buffer(trs.asset.devices.accountId, 'hex'), new Buffer(trs.asset.devices.deviceId, 'hex'), new Buffer(trs.asset.devices.deviceName, 'hex')]);

	return b;
}

HomeDevice.prototype.apply = function (trs, sender, cb, scope) {
    modules.blockchain.accounts.mergeAccountAndGet({
        address: sender.address,
        balance: -trs.fee
    }, cb);
}

HomeDevice.prototype.undo = function (trs, sender, cb, scope) {
    modules.blockchain.accounts.undoMerging({
        address: sender.address,
        balance: -trs.fee
    }, cb);
}

HomeDevice.prototype.applyUnconfirmed = function (trs, sender, cb, scope) {
    if (sender.u_balance < trs.fee) {
        return setImmediate(cb, "Sender doesn't have enough coins");
    }

    modules.blockchain.accounts.mergeAccountAndGet({
        address: sender.address,
        u_balance: -trs.fee
    }, cb);
}

HomeDevice.prototype.undoUnconfirmed = function (trs, sender, cb, scope) {
    modules.blockchain.accounts.undoMerging({
        address: sender.address,
        u_balance: -trs.fee
    }, cb);
}

HomeDevice.prototype.ready = function (trs, sender, cb, scope) {
	setImmediate(cb);
}

HomeDevice.prototype.save = function (trs, cb) {
	modules.api.sql.insert({
		table: "asset_devices",
		values: {
			transactionId: trs.id,
			accountId: trs.asset.devices.accountId,
			deviceId: trs.asset.devices.deviceId,
			deviceName: trs.asset.devices.deviceName
		}
	}, cb);
}

HomeDevice.prototype.dbRead = function (row) {
	if (!row.hd_transactionId) {
		return null;
	} else {
		return {
			devices: {
				accountId: row.hd_accountId,
				deviceId: row.hd_deviceId,
				deviceName: row.hd_deviceName
			}
		};
	}
}

HomeDevice.prototype.normalize = function (asset, cb) {
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
		required: ["accountId", "deviceId", "deviceName"]
	}, cb);
}

HomeDevice.prototype.onBind = function (_modules) {
	modules = _modules;
	modules.logic.transaction.attachAssetType(self.type, self);
}

HomeDevice.prototype.putDevice = function (cb, query) {
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

HomeDevice.prototype.getDevices = function (cb, query) {
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
                table: 'asset_devices',
                alias: "hd",
                on: {"t.id": "hd.transactionId"}
            }] // The fields have to be in the same order as in the blockchain.json
        }, ['id', 'type', 'senderId', 'senderPublicKey', 'recipientId', 'amount', 'fee', 'signature', 'blockId', 'transactionId', 'accountId', 'deviceId', 'deviceName'], function (err, transactions) {
            if (err) {
                return cb(err.toString());
            }

            // Map results to asset object
            var devices = transactions.map(function (tx) { 
                tx.asset.devices = {
                	accountId: new Buffer(tx.accountId, 'hex').toString('utf8'),
                    deviceId: new Buffer(tx.deviceId, 'hex').toString('utf8'),
                    deviceName: new Buffer(tx.deviceName, 'hex').toString('utf8')
                };

                delete tx.accountId;
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

module.exports = HomeDevice;
