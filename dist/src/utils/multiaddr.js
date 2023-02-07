import { convertToString } from '@multiformats/multiaddr/convert';
// Protocols https://github.com/multiformats/multiaddr/blob/master/protocols.csv
// code  size  name
// 4     32    ip4
// 41    128   ip6
var Protocol;
(function (Protocol) {
    Protocol[Protocol["ip4"] = 4] = "ip4";
    Protocol[Protocol["ip6"] = 41] = "ip6";
})(Protocol || (Protocol = {}));
export function multiaddrToIPStr(multiaddr) {
    for (const tuple of multiaddr.tuples()) {
        switch (tuple[0]) {
            case Protocol.ip4:
            case Protocol.ip6:
                return convertToString(tuple[0], tuple[1]);
        }
    }
    return null;
}
//# sourceMappingURL=multiaddr.js.map