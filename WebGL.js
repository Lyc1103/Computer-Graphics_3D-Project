var VSHADER_SOURCE = `
    attribute vec4 a_Position;
    attribute vec4 a_Normal;
    attribute vec2 a_TexCoord;
    attribute vec3 a_Tagent;
    attribute vec3 a_Bitagent;
    attribute float a_crossTexCoord;
    uniform mat4 u_MvpMatrix;
    uniform mat4 u_modelMatrix;
    uniform mat4 u_normalMatrix;
    uniform mat4 u_ProjMatrixFromLight;
    uniform mat4 u_MvpMatrixOfLight;
    varying vec4 v_PositionFromLight;
    varying vec3 v_Normal;
    varying vec3 v_PositionInWorld;
    varying vec2 v_TexCoord;
    varying mat4 v_TBN;
    void main(){
        gl_Position = u_MvpMatrix * a_Position;
        v_PositionInWorld = (u_modelMatrix * a_Position).xyz; 
        v_Normal = normalize(vec3(u_normalMatrix * a_Normal));
        v_TexCoord = a_TexCoord;
        // gl_Position  = vec4(0.0,0.0,0.0,1.0);
        // gl_PointSize = 10.0;

        //create TBN matrix 
        vec3 tagent = normalize(a_Tagent);
        vec3 bitagent = normalize(a_Bitagent);
        vec3 nVector;
        if( a_crossTexCoord > 0.0){
          nVector = cross(tagent, bitagent);
        } else{
          nVector = cross(bitagent, tagent);
        }
        v_TBN = mat4(tagent.x, tagent.y, tagent.z, 0.0, 
                           bitagent.x, bitagent.y, bitagent.z, 0.0,
                           nVector.x, nVector.y, nVector.z, 0.0, 
                           0.0, 0.0, 0.0, 1.0);
    }    
`;

var FSHADER_SOURCE = `
    precision mediump float;
    uniform vec3 u_LightPosition;
    uniform vec3 u_ViewPosition;
    uniform float u_Ka;
    uniform float u_Kd;
    uniform float u_Ks;
    uniform vec3 u_Color;
    uniform sampler2D u_ShadowMap;
    uniform sampler2D u_Sampler_0;
    uniform float u_shininess;
    uniform highp mat4 u_normalMatrix;
    uniform bool u_normalMode;
    varying vec3 v_Normal;
    varying vec3 v_PositionInWorld;
    varying vec2 v_TexCoord;
    varying mat4 v_TBN;
    varying vec4 v_PositionFromLight;
    const float deMachThreshold = 0.005; //0.001 if having high precision depth
    void main(){
        // (you can also input them from ouside and make them different)
        vec3 ambientLightColor = u_Color.rgb;
        vec3 diffuseLightColor = u_Color.rgb;

        vec3 texColor0 = texture2D( u_Sampler_0, v_TexCoord ).rgb;
        vec3 texColor = texColor0;
        if( distance( u_Color, vec3(-1.0, -1.0, -1.0) ) == 0.0 ){
          ambientLightColor = texColor;
          diffuseLightColor = texColor;
        }

        // assume white specular light (you can also input it from ouside)
        vec3 specularLightColor = vec3(1.0, 1.0, 1.0);        

        vec3 ambient = ambientLightColor * u_Ka;

        vec3 normal;
        if( u_normalMode ){
          //3D object's normal vector
          normal = normalize(v_Normal);
        }else{
        //normal vector from normal map
          vec3 nMapNormal = normalize( texture2D( u_Sampler_0, v_TexCoord ).rgb * 2.0 - 1.0 );
          normal = normalize( vec3( u_normalMatrix * v_TBN * vec4( nMapNormal, 1.0) ) );
        }
        
        vec3 lightDirection = normalize(u_LightPosition - v_PositionInWorld);
        float nDotL = max(dot(lightDirection, normal), 0.0);
        vec3 diffuse = diffuseLightColor * u_Kd * nDotL;

        vec3 specular = vec3(0.0, 0.0, 0.0);
        if(nDotL > 0.0) {
            vec3 R = reflect(-lightDirection, normal);
            // V: the vector, point to viewer       
            vec3 V = normalize(u_ViewPosition - v_PositionInWorld); 
            float specAngle = clamp(dot(R, V), 0.0, 1.0);
            specular = u_Ks * pow(specAngle, u_shininess) * specularLightColor; 
        }

        
        // shadow
        vec3 shadowCoord = (v_PositionFromLight.xyz/v_PositionFromLight.w)/2.0 + 0.5;
        vec4 rgbaDepth = texture2D(u_ShadowMap, shadowCoord.xy);
        ///////// LOW precision depth implementation ///////////
        float depth = rgbaDepth.r;
        float visibility = (shadowCoord.z > depth + deMachThreshold) ? 0.3 : 1.0;
        

        gl_FragColor = vec4( ambient + diffuse + specular, 1.0 );
    }
`;

var VSHADER_SOURCE_TEXTURE_ON_CUBE = `
  attribute vec4 a_Position;
  attribute vec4 a_Normal;
  uniform mat4 u_MvpMatrix;
  uniform mat4 u_modelMatrix;
  uniform mat4 u_normalMatrix;
  varying vec4 v_TexCoord;
  varying vec3 v_Normal;
  varying vec3 v_PositionInWorld;
  void main() {
    gl_Position = u_MvpMatrix * a_Position;
    v_TexCoord = a_Position;
    v_PositionInWorld = (u_modelMatrix * a_Position).xyz; 
    v_Normal = normalize(vec3(u_normalMatrix * a_Normal));
  } 
`;

var FSHADER_SOURCE_TEXTURE_ON_CUBE = `
  precision mediump float;
  varying vec4 v_TexCoord;
  uniform vec3 u_ViewPosition;
  uniform vec3 u_Color;
  uniform samplerCube u_envCubeMap;
  varying vec3 v_Normal;
  varying vec3 v_PositionInWorld;
  void main() {
    vec3 V = normalize(u_ViewPosition - v_PositionInWorld); 
    vec3 normal = normalize(v_Normal);
    vec3 R = reflect(-V, normal);
    gl_FragColor = vec4(0.78 * textureCube(u_envCubeMap, R).rgb + 0.3 * u_Color, 1.0);
  }
`;

var VSHADER_SOURCE_ENVCUBE = `
  attribute vec4 a_Position;
  varying vec4 v_Position;
  void main() {
    v_Position = a_Position;
    gl_Position = a_Position;
  } 
`;

var FSHADER_SOURCE_ENVCUBE = `
  precision mediump float;
  uniform samplerCube u_envCubeMap;
  uniform mat4 u_viewDirectionProjectionInverse;
  varying vec4 v_Position;
  void main() {
    vec4 t = u_viewDirectionProjectionInverse * v_Position;
    gl_FragColor = textureCube(u_envCubeMap, normalize(t.xyz / t.w));
  }
`;

var VSHADER_QUAD_SOURCE = `
    attribute vec4 a_Position;
    void main(){
        gl_Position = a_Position;
    }    
`;

var FSHADER_QUAD_SOURCE = `
    precision mediump float;
    uniform sampler2D u_ShadowMap;
    void main(){ 
      //TODO-2: look up the depth from u_ShaodowMap and draw on quad (just one line)
      gl_FragColor = texture2D(u_ShadowMap, vec2(gl_FragCoord.x/800.0, gl_FragCoord.y/800.0) );
    }
`;

var VSHADER_SHADOW_SOURCE = `
      attribute vec4 a_Position;
      uniform mat4 u_MvpMatrix;
      void main(){
          gl_Position = u_MvpMatrix * a_Position;
      }
  `;

var FSHADER_SHADOW_SOURCE = `
      precision mediump float;
      void main(){
        ///////// LOW precision depth implementation /////
        gl_FragColor = vec4(gl_FragCoord.z, gl_FragCoord.z, gl_FragCoord.z, 1.0);
      }
  `;

function compileShader(gl, vShaderText, fShaderText){
    //////Build vertex and fragment shader objects
    var vertexShader = gl.createShader(gl.VERTEX_SHADER)
    var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)
    //The way to  set up shader text source
    gl.shaderSource(vertexShader, vShaderText)
    gl.shaderSource(fragmentShader, fShaderText)
    //compile vertex shader
    gl.compileShader(vertexShader)
    if(!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)){
        console.log('vertex shader ereror');
        var message = gl.getShaderInfoLog(vertexShader); 
        console.log(message);//print shader compiling error message
    }
    //compile fragment shader
    gl.compileShader(fragmentShader)
    if(!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)){
        console.log('fragment shader ereror');
        var message = gl.getShaderInfoLog(fragmentShader);
        console.log(message);//print shader compiling error message
    }

    /////link shader to program (by a self-define function)
    var program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    //if not success, log the program info, and delete it.
    if(!gl.getProgramParameter(program, gl.LINK_STATUS)){
        alert(gl.getProgramInfoLog(program) + "");
        gl.deleteProgram(program);
    }

    return program;
}

/////BEGIN:///////////////////////////////////////////////////////////////////////////////////////////////
/////The folloing three function is for creating vertex buffer, but link to shader to user later//////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////
function initAttributeVariable(gl, a_attribute, buffer){
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.vertexAttribPointer(a_attribute, buffer.num, buffer.type, false, 0, 0);
  gl.enableVertexAttribArray(a_attribute);
}

function initArrayBufferForLaterUse(gl, data, num, type) {
  // Create a buffer object
  var buffer = gl.createBuffer();
  if (!buffer) {
    console.log('Failed to create the buffer object');
    return null;
  }
  // Write date into the buffer object
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);

  // Store the necessary information to assign the object to the attribute variable later
  buffer.num = num;
  buffer.type = type;

  return buffer;
}

function initVertexBufferForLaterUse(gl, vertices, normals, texCoords, tagents, bitagents, crossTexCoords){
  var nVertices = vertices.length / 3;

  var o = new Object();
  o.vertexBuffer = initArrayBufferForLaterUse(gl, new Float32Array(vertices), 3, gl.FLOAT);
  if( normals != null ) o.normalBuffer = initArrayBufferForLaterUse(gl, new Float32Array(normals), 3, gl.FLOAT);
  if( texCoords != null ) o.texCoordBuffer = initArrayBufferForLaterUse(gl, new Float32Array(texCoords), 2, gl.FLOAT);
  if( tagents != null ) o.tagentsBuffer = initArrayBufferForLaterUse(gl, new Float32Array(tagents), 3, gl.FLOAT);
  if( bitagents != null ) o.bitagentsBuffer = initArrayBufferForLaterUse(gl, new Float32Array(bitagents), 3, gl.FLOAT);
  if( crossTexCoords != null ) o.crossTexCoordsBuffer = initArrayBufferForLaterUse(gl, new Float32Array(crossTexCoords), 1, gl.FLOAT);
  //you can have error check here
  o.numVertices = nVertices;

  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

  return o;
}
/////END://///////////////////////////////////////////////////////////////////////////////////////////////
/////The folloing three function is for creating vertex buffer, but link to shader to user later//////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////

///// normal vector calculation (for the cube)
function getNormalOnVertices(vertices){
  var normals = [];
  var nTriangles = vertices.length/9;
  for(let i=0; i < nTriangles; i ++ ){
      var idx = i * 9 + 0 * 3;
      var p0x = vertices[idx+0], p0y = vertices[idx+1], p0z = vertices[idx+2];
      idx = i * 9 + 1 * 3;
      var p1x = vertices[idx+0], p1y = vertices[idx+1], p1z = vertices[idx+2];
      idx = i * 9 + 2 * 3;
      var p2x = vertices[idx+0], p2y = vertices[idx+1], p2z = vertices[idx+2];

      var ux = p1x - p0x, uy = p1y - p0y, uz = p1z - p0z;
      var vx = p2x - p0x, vy = p2y - p0y, vz = p2z - p0z;

      var nx = uy*vz - uz*vy;
      var ny = uz*vx - ux*vz;
      var nz = ux*vy - uy*vx;

      var norm = Math.sqrt(nx*nx + ny*ny + nz*nz);
      nx = nx / norm;
      ny = ny / norm;
      nz = nz / norm;

      normals.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
  }
  return normals;
}

function getBallNormalOnVertices(vertices){
  var noramls = [];
  var nTriangles = vertices.length/9;
  for( let i = 0; i < nTriangles; i++ ){
    var idx = i * 9 + 0 * 3;
      var p0x = vertices[idx+0], p0y = vertices[idx+1], p0z = vertices[idx+2];
      idx = i * 9 + 1 * 3;
      var p1x = vertices[idx+0], p1y = vertices[idx+1], p1z = vertices[idx+2];
      idx = i * 9 + 2 * 3;
      var p2x = vertices[idx+0], p2y = vertices[idx+1], p2z = vertices[idx+2];
  }
}

var mouseLastX, mouseLastY;
var mouseDragging = false;
var angleX = 0, angleY = 0;
var gl, canvas;
var modelMatrix;
var normalMatrix;
var nVertex;
var marioX = 0.0, marioY = -5.0, marioZ = -16.0;
var cameraX = 0, cameraY = 15, cameraZ = 7;
var cameraDirX = 0, cameraDirY = 0, cameraDirZ = -1;
var lightX = 5, lightY = 1, lightZ = 7;
var cubeObj = [];
var quadObj;
var cubeMapTex;
var objScale = 0.05;
var objComponents = [];
var miku = [];
var ruffy = [];
var cube = [];
var halfball = [];
var cylinder = [];
var disc = [];
var pyramid = [];
var sphereObj;
var textures = {};
var texCount = 0;

var marioObj;
var marioImgNames = ["marioD.jpg"];
var marioObjCompImgIndex = ["marioD.jpg"];

var sonicObj;
var sonicImgNames = ["64124be4.jpg", "bab97353.jpg", "d1419efe.jpg", "f1f6d3cb.jpg"];
var sonicObjCompImgIndex = ["d1419efe.jpg", "64124be4.jpg", "64124be4.jpg", "f1f6d3cb.jpg", 
                       "bab97353.jpg", "64124be4.jpg", "64124be4.jpg", "64124be4.jpg", 
                       "f1f6d3cb.jpg", "64124be4.jpg", "bab97353.jpg", "f1f6d3cb.jpg", 
                       "d1419efe.jpg"];
var mikuObj;
var ruffyObj;
var airplaneObj;
var treeObj;
var girlObj;
var _cubeObj;
var moveDistance_x = 0;
var moveDistance_y = 0;
var rotateAngle = 0;
var rightHandAngle = 0;
var leftHandAngle = 0;
var floorScale = 50;
var _scale = 0;
var _translate_straight = 0.0;
var _translate_horizon = 0.0;
var marioFace = 180;
var fbo;
var offScreenWidth = 256, offScreenHeight = 256; //for cubemap render
var normalMode = 1;

var ThirdPersonPrespective = true;

async function main(){
    canvas = document.getElementById('webgl');
    gl = canvas.getContext('webgl2');
    if(!gl){
        console.log('Failed to get the rendering context for WebGL');
        return ;
    }

/////////////////////////////////////////QUAD/////////////////////////////////////////////

    var quad = new Float32Array(
      [
        -1, -1, 1,
         1, -1, 1,
        -1,  1, 1,
        -1,  1, 1,
         1, -1, 1,
         1,  1, 1
      ]); //just a quad

    programEnvCube = compileShader(gl, VSHADER_SOURCE_ENVCUBE, FSHADER_SOURCE_ENVCUBE);
    programEnvCube.a_Position = gl.getAttribLocation(programEnvCube, 'a_Position'); 
    programEnvCube.u_envCubeMap = gl.getUniformLocation(programEnvCube, 'u_envCubeMap'); 
    programEnvCube.u_viewDirectionProjectionInverse = 
               gl.getUniformLocation(programEnvCube, 'u_viewDirectionProjectionInverse'); 

    quadObj = initVertexBufferForLaterUse(gl, quad);

    cubeMapTex = initCubeTexture("posx.jpg", "negx.jpg", "posy.jpg", "negy.jpg", 
                                      "posz.jpg", "negz.jpg", 512, 512)



////////////////////////////////////OBJ////////////////////////////////////////


    sphereObj = await loadOBJtoCreateVBO('sphere.obj');
    _cubeObj = await loadOBJtoCreateVBO('cube.obj');
    marioObj = await loadOBJtoCreateVBO('mario.obj');
    mikuObj = await loadOBJtoCreateVBO('miku.obj');
    ruffyObj = await loadOBJtoCreateVBO('ruffy.obj');
    sonicObj = await loadOBJtoCreateVBO('sonic.obj');
    airplaneObj = await loadOBJtoCreateVBO('us-c-130-hercules-airplane.obj');
    girlObj = await loadOBJtoCreateVBO("girl-brunette");
    treeObj = await loadOBJtoCreateVBO("tree-05.obj");
    quadObj = await loadOBJtoCreateVBO('quad.obj');

    //setup shaders and prepare shader variables
    shadowProgram = compileShader(gl, VSHADER_SHADOW_SOURCE, FSHADER_SHADOW_SOURCE);
    shadowProgram.a_Position = gl.getAttribLocation(shadowProgram, 'a_Position');
    shadowProgram.u_MvpMatrix = gl.getUniformLocation(shadowProgram, 'u_MvpMatrix');

    program = compileShader(gl, VSHADER_SOURCE, FSHADER_SOURCE);
    program.a_Position = gl.getAttribLocation(program, 'a_Position'); 
    program.a_TexCoord = gl.getAttribLocation(program, 'a_TexCoord');
    program.a_Normal = gl.getAttribLocation(program, 'a_Normal'); 
    program.a_Tagent = gl.getAttribLocation(program, 'a_Tagent'); 
    program.a_Bitagent = gl.getAttribLocation(program, 'a_Bitagent'); 
    program.a_crossTexCoord = gl.getAttribLocation(program, 'a_crossTexCoord'); 
    program.u_MvpMatrix = gl.getUniformLocation(program, 'u_MvpMatrix'); 
    program.u_modelMatrix = gl.getUniformLocation(program, 'u_modelMatrix'); 
    program.u_normalMatrix = gl.getUniformLocation(program, 'u_normalMatrix');
    program.u_LightPosition = gl.getUniformLocation(program, 'u_LightPosition');
    program.u_ViewPosition = gl.getUniformLocation(program, 'u_ViewPosition');
    program.u_MvpMatrixOfLight = gl.getUniformLocation(program, 'u_MvpMatrixOfLight'); 
    program.u_Ka = gl.getUniformLocation(program, 'u_Ka'); 
    program.u_Kd = gl.getUniformLocation(program, 'u_Kd');
    program.u_Ks = gl.getUniformLocation(program, 'u_Ks');
    program.u_Sampler_0 = gl.getUniformLocation(program, "u_Sampler_0");
    program.u_shininess = gl.getUniformLocation(program, 'u_shininess');
    program.u_ShadowMap = gl.getUniformLocation(program, "u_ShadowMap");
    program.u_Color = gl.getUniformLocation(program, 'u_Color');
    program.u_shininess = gl.getUniformLocation(program, 'u_shininess');
    program.u_normalMode = gl.getUniformLocation(program, 'u_normalMode');

    quadProgram = compileShader(gl, VSHADER_QUAD_SOURCE, FSHADER_QUAD_SOURCE);
    quadProgram.a_Position = gl.getAttribLocation(quadProgram, 'a_Position');
    quadProgram.u_ShadowMap = gl.getUniformLocation(quadProgram, "u_ShadowMap");

    programTextureOnCube = compileShader(gl, VSHADER_SOURCE_TEXTURE_ON_CUBE, FSHADER_SOURCE_TEXTURE_ON_CUBE);
    programTextureOnCube.a_Position = gl.getAttribLocation(programTextureOnCube, 'a_Position'); 
    programTextureOnCube.a_Normal = gl.getAttribLocation(programTextureOnCube, 'a_Normal'); 
    programTextureOnCube.u_MvpMatrix = gl.getUniformLocation(programTextureOnCube, 'u_MvpMatrix'); 
    programTextureOnCube.u_modelMatrix = gl.getUniformLocation(programTextureOnCube, 'u_modelMatrix'); 
    programTextureOnCube.u_normalMatrix = gl.getUniformLocation(programTextureOnCube, 'u_normalMatrix');
    programTextureOnCube.u_ViewPosition = gl.getUniformLocation(programTextureOnCube, 'u_ViewPosition');
    programTextureOnCube.u_envCubeMap = gl.getUniformLocation(programTextureOnCube, 'u_envCubeMap'); 
    programTextureOnCube.u_Color = gl.getUniformLocation(programTextureOnCube, 'u_Color'); 
    

    fbo = initFrameBufferForCubemapRendering(gl);

     for( let i=0; i < marioImgNames.length; i ++ ){
      let image = new Image();
      image.onload = function(){initTexture(gl, image, marioImgNames[i]);};
      image.src = marioImgNames[i];
    }
    var normalMapImage = new Image();
    normalMapImage.onload = function(){initTexture(gl, normalMapImage, "normalMapImage");};
    normalMapImage.src = "normalMap.jpeg";

    canvas.onmousedown = function(ev){mouseDown(ev)};
    canvas.onmousemove = function(ev){mouseMove(ev)};
    canvas.onmouseup = function(ev){mouseUp(ev)};
    document.onkeydown = function(ev){keydown(ev)};

    var tick = function() {
      rotateAngle += 0.45;
      draw();
      requestAnimationFrame(tick);
    }
    tick();

    var menu = document.getElementById("menu");
    menu.onchange = function() {
        if(this.value === "ThirdPreson") ThirdPersonPrespective = true;
        else ThirdPersonPrespective = false;
        draw();
    }

    var menu = document.getElementById("menu2");
    menu.onchange = function() {
        if(this.value == "3DModelNormal") normalMode = 1;
        else normalMode = 0;
        draw();
    }
}

function drawQuad( projMatrix, viewMatrix ){
  var quad = new Float32Array(
    [
      -1, -1, 1,
       1, -1, 1,
      -1,  1, 1,
      -1,  1, 1,
       1, -1, 1,
       1,  1, 1
    ]); //just a quad

  programEnvCube = compileShader(gl, VSHADER_SOURCE_ENVCUBE, FSHADER_SOURCE_ENVCUBE);
  programEnvCube.a_Position = gl.getAttribLocation(programEnvCube, 'a_Position'); 
  programEnvCube.u_envCubeMap = gl.getUniformLocation(programEnvCube, 'u_envCubeMap'); 
  programEnvCube.u_viewDirectionProjectionInverse = 
             gl.getUniformLocation(programEnvCube, 'u_viewDirectionProjectionInverse');

  quadObj = initVertexBufferForLaterUse(gl, quad);

  gl.clearColor(0.4, 0.4, 0.4, 1);
  //gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST);
  
  let rotateMatrix = new Matrix4();
  rotateMatrix.setRotate(angleY, 1, 0, 0);//for mouse rotation
  rotateMatrix.rotate(angleX, 0, 1, 0);//for mouse rotation
  var viewDir= new Vector3([cameraDirX, cameraDirY, cameraDirZ]);
  var newViewDir = rotateMatrix.multiplyVector3(viewDir);

  
  var vpFromCamera = new Matrix4();
  vpFromCamera.set(projMatrix);
  var viewMatrixRotationOnly = new Matrix4();
  viewMatrixRotationOnly.set(viewMatrix);
  viewMatrixRotationOnly.elements[12] = 0; //ignore translation
  viewMatrixRotationOnly.elements[13] = 0;
  viewMatrixRotationOnly.elements[14] = 0;
  vpFromCamera.multiply(viewMatrixRotationOnly);
  var vpFromCameraInverse = vpFromCamera.invert();

  //quad
  gl.useProgram(programEnvCube);
  gl.depthFunc(gl.LEQUAL);
  gl.uniformMatrix4fv(programEnvCube.u_viewDirectionProjectionInverse, 
                      false, vpFromCameraInverse.elements);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubeMapTex);
  gl.uniform1i(programEnvCube.u_envCubeMap, 0);
  initAttributeVariable(gl, programEnvCube.a_Position, quadObj.vertexBuffer);
  gl.drawArrays(gl.TRIANGLES, 0, quadObj.numVertices);
}

function draw(){
  renderCubeMap(0, 0, 0);

  /*
  ///// off scree shadow
  gl.useProgram(shadowProgram);
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.viewport(0, 0, offScreenWidth, offScreenHeight);
  gl.clearColor(0.0, 0.0, 0.0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST);
  //cube
  let cubeMdlMatrix = new Matrix4();
  cubeMdlMatrix.setScale(2.0, 0.1, 2.0);
  let cubeMvpFromLight = drawOffScreen(cubeObj, cubeMdlMatrix);
  //mario
  let marioMdlMatrix = new Matrix4();
  marioMdlMatrix.setTranslate(0.0, 1.4, 0.0);
  marioMdlMatrix.scale(0.02,0.02,0.02);
  let marioMvpFromLight = drawOffScreen(marioObj, marioMdlMatrix);
  */

  ///// on scree rendering

  gl.useProgram(program);
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0.4,0.4,0.4,1);
  //gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST);
  
  let rotateMatrix = new Matrix4();
  var viewDir;
  var newViewDir;
  let vpMatrix = new Matrix4();
  var projMatrix = new Matrix4();
  var viewMatrix = new Matrix4();

  //console.log(ThirdPersonPrespective);
  if( !ThirdPersonPrespective ){
      var marioMdlMatrix = new Matrix4();
      marioMdlMatrix.setTranslate(marioX-_translate_horizon, marioY, marioZ-_translate_straight);
      marioMdlMatrix.rotate(180+marioFace, 0, 1, 0);
      var marioObjVector = new Vector4([0,0,0,1]);
      var marioPositionNow = marioMdlMatrix.multiplyVector4(marioObjVector);

      //console.log(marioMdlMatrix);
      //console.log(marioPositionNow.elements[0], marioPositionNow.elements[1], marioPositionNow.elements[2] );

      cameraX = marioPositionNow.elements[0];
      cameraY = marioPositionNow.elements[1];
      cameraZ = marioPositionNow.elements[2];
  }else{
    cameraX = 0;
    cameraY = 15;
    cameraZ = 7;
  }
  
  
  if( !ThirdPersonPrespective ){
    rotateMatrix.setRotate(angleY, 1, 0, 0);//for mouse rotation
    rotateMatrix.rotate(angleX, 0, 1, 0);//for mouse rotation
    rotateMatrix.rotate(180+marioFace, 0, 1, 0);
  }
  else{
    rotateMatrix.setRotate(angleY, 1, 0, 0);//for mouse rotation
    rotateMatrix.rotate(angleX, 0, 1, 0);//for mouse rotation
  }
  viewDir= new Vector3([cameraDirX, cameraDirY, cameraDirZ]);
  newViewDir = rotateMatrix.multiplyVector3(viewDir);
  //let vpMatrix = new Matrix4();
  vpMatrix.setPerspective(70, 1, 1, 100);
  vpMatrix.lookAt(cameraX, cameraY, cameraZ,   
                  cameraX + newViewDir.elements[0], 
                  cameraY + newViewDir.elements[1],
                  cameraZ + newViewDir.elements[2], 
                  0, 1, 0);
  //var projMatrix = new Matrix4();
  projMatrix.setPerspective(70, 1, 1, 100);
  //var viewMatrix = new Matrix4();
  viewMatrix.lookAt(cameraX, cameraY, cameraZ,   
                    cameraX + newViewDir.elements[0], 
                    cameraY + newViewDir.elements[1],
                    cameraZ + newViewDir.elements[2], 
                    0, 1, 0)
  
  drawRegularObjects(vpMatrix);//miku, mario

  drawQuad( projMatrix, viewMatrix );

  
  gl.useProgram(program);
  //the sphere
  let mdlMatrix = new Matrix4();
  mdlMatrix.setScale(0.5, 0.5, 0.5);
  mdlMatrix.translate(-2.0, 10.0, 2.0);
  drawObjectWithDynamicReflection(sphereObj, mdlMatrix, vpMatrix, 0.95, 0.85, 0.4);
  
}

function drawRegularObjects(vpMatrix){
  let mdlMatrix = new Matrix4();

  //sonic
  mdlMatrix.setTranslate(-40.0, -10.0, 0.0);
  mdlMatrix.rotate(90, 0, 1, 0);
  mdlMatrix.scale(0.3, 0.3,0.3);
  drawOneRegularObject(sonicObj, mdlMatrix, vpMatrix, 0.4, 1.0, 0.4);

  //airplane
  mdlMatrix.setRotate(rotateAngle, 0, 1, 0);
  mdlMatrix.translate(2.5, 5.0, 1.5);
  mdlMatrix.scale(0.05, 0.05, 0.05);
  drawOneRegularObject(airplaneObj, mdlMatrix, vpMatrix, 0.8, 0.8, 0.8);

  //miku
  //mdlMatrix.setRotate(rotateAngle, 0, 1, 0);
  //mdlMatrix.setTranslate(0.0, -120.0, -50.0);
  mdlMatrix.setTranslate(0.0, -7.0, -30.0);
  mdlMatrix.scale(0.5, 0.5, 0.5);
  drawOneRegularObject(mikuObj, mdlMatrix, vpMatrix, 1.0, 0.7, 0.7);
  //drawObjWithShader(mikuObj, mdlMatrix, vpMatrix, -1, -1, -1, mikuImgNames );
  //console.log(mikuImgNames.length);

  //ruffy
  mdlMatrix.setTranslate(40.0, -9.5, 0.0);
  mdlMatrix.rotate(-90, 0, 1, 0);
  mdlMatrix.scale(0.08, 0.08, 0.08);
  drawOneRegularObject(ruffyObj, mdlMatrix, vpMatrix, 0.7, 0.7, 0.4);

  //mario
  var marioMdlMatrix = new Matrix4();
  marioMdlMatrix.setTranslate(marioX-_translate_horizon, marioY, marioZ-_translate_straight);
  marioMdlMatrix.rotate(180+marioFace, 0, 1, 0);
  var marioObjVector = new Vector4([0,0,0,1]);
  var marioPositionNow = marioMdlMatrix.multiplyVector4(marioObjVector);
  mdlMatrix.setTranslate( 0.0, -6.5, -15.0);
  mdlMatrix.translate(-_translate_horizon, 0.0, -_translate_straight);
  /*
  if( marioPositionNow.elements[0] <= floorScale && marioPositionNow.elements[0] >= -floorScale){
    mdlMatrix.translate(-_translate_horizon, 0.0, 0.0);
    //mdlMatrix.setTranslate( marioPositionNow.elements[0], -6.5, marioPositionNow.elements[1]);
  }
  else
  {
    mdlMatrix.translate( marioPositionNow.elements[0], marioPositionNow.elements[2], marioPositionNow.elements[1]);
  }
  if( marioPositionNow.elements[1] <= floorScale  && marioPositionNow.elements[1] >= -floorScale){
    mdlMatrix.translate(0.0, 0.0, -_translate_straight );
    //mdlMatrix.setTranslate( marioPositionNow.elements[0], -6.5, marioPositionNow.elements[1]);
  }
  // else if( marioPositionNow.elements[1] >= floorScale  ){
  //   mdlMatrix.setTranslate( marioPositionNow.elements[0], -6.5, marioPositionNow.elements[1]);
  // }
  // else if( marioPositionNow.elements[1] <= -floorScale  ){
  //   mdlMatrix.setTranslate( marioPositionNow.elements[0], -6.5, marioPositionNow.elements[1]);
  // }
  console.log(marioPositionNow.elements[0], marioPositionNow.elements[1]);
  */
  mdlMatrix.rotate(marioFace, 0, 1, 0);
  mdlMatrix.scale(0.05, 0.05, 0.05);
  if(ThirdPersonPrespective)
    drawObjWithShader(marioObj, mdlMatrix, vpMatrix, -1, -1, -1, marioImgNames );

  //tree
  mdlMatrix.setTranslate(-40.0, -9.5, 40.0);
  mdlMatrix.scale(0.3, 0.3, 0.3);
  drawOneRegularObject(treeObj, mdlMatrix, vpMatrix, 0.4, 1.0, 0.4);
  mdlMatrix.setTranslate(-20.0, -9.5, 40.0);
  mdlMatrix.scale(0.3, 0.3, 0.3);
  drawOneRegularObject(treeObj, mdlMatrix, vpMatrix, 0.4, 1.0, 0.4);
  mdlMatrix.setTranslate(0.0, -9.5, 40.0);
  mdlMatrix.scale(0.3, 0.3, 0.3);
  drawOneRegularObject(treeObj, mdlMatrix, vpMatrix, 0.4, 1.0, 0.4);
  mdlMatrix.setTranslate(20.0, -9.5, 40.0);
  mdlMatrix.scale(0.3, 0.3, 0.3);
  drawOneRegularObject(treeObj, mdlMatrix, vpMatrix, 0.4, 1.0, 0.4);
  mdlMatrix.setTranslate(40.0, -9.5, 40.0);
  mdlMatrix.scale(0.3, 0.3, 0.3);
  drawOneRegularObject(treeObj, mdlMatrix, vpMatrix, 0.4, 1.0, 0.4);
  mdlMatrix.setTranslate(-40.0, -9.5, -40.0);
  mdlMatrix.scale(0.3, 0.3, 0.3);
  drawOneRegularObject(treeObj, mdlMatrix, vpMatrix, 0.4, 1.0, 0.4);
  
  //sphere on light
  mdlMatrix.setTranslate(5.0, 1.0, 7.0);
  mdlMatrix.scale(0.1, 0.1, 0.1);
  drawOneRegularObject(sphereObj, mdlMatrix, vpMatrix, 1.0, 1.0, 0.0);

  //地板
  mdlMatrix.setTranslate(0.0, -10.0, 0.0);
  mdlMatrix.scale(floorScale, 0.01, floorScale);
  drawOneRegularObject(_cubeObj, mdlMatrix, vpMatrix, 0.128, 0.042, 0.042);
}

function drawObjWithShader(obj, modelMatrix, vpMatrix, colorR, colorG, colorB, objCompImgIndex){
  gl.clearColor(0,0,0,1);

  gl.useProgram(program);
  let mvpMatrix = new Matrix4();
  let normalMatrix = new Matrix4();
  mvpMatrix.set(vpMatrix);
  mvpMatrix.multiply(modelMatrix);

  gl.enable(gl.DEPTH_TEST);

  //normal matrix
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();

  gl.uniform3f(program.u_LightPosition, lightX, lightY, lightZ);
  gl.uniform3f(program.u_ViewPosition, cameraX, cameraY, cameraZ);
  gl.uniform1f(program.u_Ka, 0.2);
  gl.uniform1f(program.u_Kd, 0.7);
  gl.uniform1f(program.u_Ks, 1.0);
  gl.uniform1f(program.u_shininess, 10.0);
  gl.uniform3f(program.u_Color, colorR, colorG, colorB);

  gl.uniformMatrix4fv(program.u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(program.u_modelMatrix, false, modelMatrix.elements);
  gl.uniformMatrix4fv(program.u_normalMatrix, false, normalMatrix.elements);

  for( let i=0; i < obj.length; i ++ ){
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, textures[objCompImgIndex[i]]);
    gl.uniform1i(program.u_Sampler_0, 0);
    
    initAttributeVariable(gl, program.a_Position, obj[i].vertexBuffer);
    initAttributeVariable(gl, program.a_TexCoord, obj[i].texCoordBuffer);
    initAttributeVariable(gl, program.a_Normal, obj[i].normalBuffer);

    gl.drawArrays(gl.TRIANGLES, 0, obj[i].numVertices);
  }
 
}

function drawOneRegularObject(obj, modelMatrix, vpMatrix, colorR, colorG, colorB){
  gl.useProgram(program);
  let mvpMatrix = new Matrix4();
  let normalMatrix = new Matrix4();
  mvpMatrix.set(vpMatrix);
  mvpMatrix.multiply(modelMatrix);

  //normal matrix
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();

  gl.uniform3f(program.u_LightPosition, lightX, lightY, lightZ);
  gl.uniform3f(program.u_ViewPosition, cameraX, cameraY, cameraZ);
  gl.uniform1f(program.u_Ka, 0.2);
  gl.uniform1f(program.u_Kd, 0.7);
  gl.uniform1f(program.u_Ks, 1.0);
  gl.uniform1f(program.u_shininess, 10.0);
  gl.uniform3f(program.u_Color, colorR, colorG, colorB);
  gl.uniform1i(program.u_Sampler0, 0);
  gl.uniform1i(program.u_Sampler1, 1);
  gl.uniform1i(program.u_normalMode, normalMode);

  gl.uniformMatrix4fv(program.u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(program.u_modelMatrix, false, modelMatrix.elements);
  gl.uniformMatrix4fv(program.u_normalMatrix, false, normalMatrix.elements);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, textures["normalMapImage"]);

  for( let i=0; i < obj.length; i ++ ){
    initAttributeVariable(gl, program.a_Position, obj[i].vertexBuffer);
    initAttributeVariable(gl, program.a_Normal, obj[i].normalBuffer);
    initAttributeVariable(gl, program.a_TexCoord, obj[i].texCoordBuffer);
    initAttributeVariable(gl, program.a_Tagent, obj[i].tagentsBuffer);
    initAttributeVariable(gl, program.a_Bitagent, obj[i].bitagentsBuffer);
    initAttributeVariable(gl, program.a_crossTexCoord, obj[i].crossTexCoordsBuffer);
    gl.drawArrays(gl.TRIANGLES, 0, obj[i].numVertices);
  }
}

function drawObjectWithDynamicReflection(obj, modelMatrix, vpMatrix, colorR, colorG, colorB){
  gl.useProgram(programTextureOnCube);
  let mvpMatrix = new Matrix4();
  let normalMatrix = new Matrix4();
  mvpMatrix.set(vpMatrix);
  mvpMatrix.multiply(modelMatrix);

  //normal matrix
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();

  gl.uniform3f(programTextureOnCube.u_ViewPosition, cameraX, cameraY, cameraZ);
  gl.uniform3f(programTextureOnCube.u_Color, colorR, colorG, colorB);

  gl.uniformMatrix4fv(programTextureOnCube.u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(programTextureOnCube.u_modelMatrix, false, modelMatrix.elements);
  gl.uniformMatrix4fv(programTextureOnCube.u_normalMatrix, false, normalMatrix.elements);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_CUBE_MAP, fbo.texture);
  //gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubeMapTex);
  gl.uniform1i(programTextureOnCube.u_envCubeMap, 0);

  for( let i=0; i < obj.length; i ++ ){
    initAttributeVariable(gl, programTextureOnCube.a_Position, obj[i].vertexBuffer);
    initAttributeVariable(gl, programTextureOnCube.a_Normal, obj[i].normalBuffer);
    gl.drawArrays(gl.TRIANGLES, 0, obj[i].numVertices);
  }
}

function calculateTangentSpace(position, texcoord){
  //iterate through all triangles
  let tagents = [];
  let bitagents = [];
  let crossTexCoords = [];
  for( let i = 0; i < position.length/9; i++ ){
    let v00 = position[i*9 + 0];
    let v01 = position[i*9 + 1];
    let v02 = position[i*9 + 2];
    let v10 = position[i*9 + 3];
    let v11 = position[i*9 + 4];
    let v12 = position[i*9 + 5];
    let v20 = position[i*9 + 6];
    let v21 = position[i*9 + 7];
    let v22 = position[i*9 + 8];
    let uv00 = texcoord[i*6 + 0];
    let uv01 = texcoord[i*6 + 1];
    let uv10 = texcoord[i*6 + 2];
    let uv11 = texcoord[i*6 + 3];
    let uv20 = texcoord[i*6 + 4];
    let uv21 = texcoord[i*6 + 5];

    let deltaPos10 = v10 - v00;
    let deltaPos11 = v11 - v01;
    let deltaPos12 = v12 - v02;
    let deltaPos20 = v20 - v00;
    let deltaPos21 = v21 - v01;
    let deltaPos22 = v22 - v02;

    let deltaUV10 = uv10 - uv00;
    let deltaUV11 = uv11 - uv01;
    let deltaUV20 = uv20 - uv00;
    let deltaUV21 = uv21 - uv01;

    let r = 1.0 / (deltaUV10 * deltaUV21 - deltaUV11 * deltaUV20);
    for( let j=0; j< 3; j++ ){
      crossTexCoords.push( (deltaUV10 * deltaUV21 - deltaUV11 * deltaUV20) );
    }
    let tangentX = (deltaPos10 * deltaUV21 - deltaPos20 * deltaUV11)*r;
    let tangentY = (deltaPos11 * deltaUV21 - deltaPos21 * deltaUV11)*r;
    let tangentZ = (deltaPos12 * deltaUV21 - deltaPos22 * deltaUV11)*r;
    for( let j = 0; j < 3; j++ ){
      tagents.push(tangentX);
      tagents.push(tangentY);
      tagents.push(tangentZ);
    }
    let bitangentX = (deltaPos20 * deltaUV10 - deltaPos10 * deltaUV20)*r;
    let bitangentY = (deltaPos21 * deltaUV10 - deltaPos11 * deltaUV20)*r;
    let bitangentZ = (deltaPos22 * deltaUV10 - deltaPos12 * deltaUV20)*r;
    for( let j = 0; j < 3; j++ ){
      bitagents.push(bitangentX);
      bitagents.push(bitangentY);
      bitagents.push(bitangentZ);
    }
  }
  let obj = {};
  obj['tagents'] = tagents;
  obj['bitagents'] = bitagents;
  obj['crossTexCoords'] = crossTexCoords;
  return obj;
}

async function loadOBJtoCreateVBO( objFile ){
  objComponents = [];
  response = await fetch(objFile);
  text = await response.text();
  obj = parseOBJ(text);

  for( let i=0; i < obj.geometries.length; i ++ ){
    let tagentSpace = calculateTangentSpace(obj.geometries[i].data.position, 
                                            obj.geometries[i].data.texcoord);
    let o = initVertexBufferForLaterUse(gl, 
                                        obj.geometries[i].data.position,
                                        obj.geometries[i].data.normal, 
                                        obj.geometries[i].data.texcoord,
                                        tagentSpace.tagents,
                                        tagentSpace.bitagents,
                                        tagentSpace.crossTexCoords);
    objComponents.push(o);
  }
  return objComponents;
}

function parseOBJ(text) {
  // because indices are base 1 let's just fill in the 0th data
  const objPositions = [[0, 0, 0]];
  const objTexcoords = [[0, 0]];
  const objNormals = [[0, 0, 0]];

  // same order as `f` indices
  const objVertexData = [
    objPositions,
    objTexcoords,
    objNormals,
  ];

  // same order as `f` indices
  let webglVertexData = [
    [],   // positions
    [],   // texcoords
    [],   // normals
  ];

  const materialLibs = [];
  const geometries = [];
  let geometry;
  let groups = ['default'];
  let material = 'default';
  let object = 'default';

  const noop = () => {};

  function newGeometry() {
    // If there is an existing geometry and it's
    // not empty then start a new one.
    if (geometry && geometry.data.position.length) {
      geometry = undefined;
    }
  }

  function setGeometry() {
    if (!geometry) {
      const position = [];
      const texcoord = [];
      const normal = [];
      webglVertexData = [
        position,
        texcoord,
        normal,
      ];
      geometry = {
        object,
        groups,
        material,
        data: {
          position,
          texcoord,
          normal,
        },
      };
      geometries.push(geometry);
    }
  }

  function addVertex(vert) {
    const ptn = vert.split('/');
    ptn.forEach((objIndexStr, i) => {
      if (!objIndexStr) {
        return;
      }
      const objIndex = parseInt(objIndexStr);
      const index = objIndex + (objIndex >= 0 ? 0 : objVertexData[i].length);
      webglVertexData[i].push(...objVertexData[i][index]);
    });
  }

  const keywords = {
    v(parts) {
      objPositions.push(parts.map(parseFloat));
    },
    vn(parts) {
      objNormals.push(parts.map(parseFloat));
    },
    vt(parts) {
      // should check for missing v and extra w?
      objTexcoords.push(parts.map(parseFloat));
    },
    f(parts) {
      setGeometry();
      const numTriangles = parts.length - 2;
      for (let tri = 0; tri < numTriangles; ++tri) {
        addVertex(parts[0]);
        addVertex(parts[tri + 1]);
        addVertex(parts[tri + 2]);
      }
    },
    s: noop,    // smoothing group
    mtllib(parts, unparsedArgs) {
      // the spec says there can be multiple filenames here
      // but many exist with spaces in a single filename
      materialLibs.push(unparsedArgs);
    },
    usemtl(parts, unparsedArgs) {
      material = unparsedArgs;
      newGeometry();
    },
    g(parts) {
      groups = parts;
      newGeometry();
    },
    o(parts, unparsedArgs) {
      object = unparsedArgs;
      newGeometry();
    },
  };

  const keywordRE = /(\w*)(?: )*(.*)/;
  const lines = text.split('\n');
  for (let lineNo = 0; lineNo < lines.length; ++lineNo) {
    const line = lines[lineNo].trim();
    if (line === '' || line.startsWith('#')) {
      continue;
    }
    const m = keywordRE.exec(line);
    if (!m) {
      continue;
    }
    const [, keyword, unparsedArgs] = m;
    const parts = line.split(/\s+/).slice(1);
    const handler = keywords[keyword];
    if (!handler) {
      console.warn('unhandled keyword:', keyword);  // eslint-disable-line no-console
      continue;
    }
    handler(parts, unparsedArgs);
  }

  // remove any arrays that have no entries.
  for (const geometry of geometries) {
    geometry.data = Object.fromEntries(
        Object.entries(geometry.data).filter(([, array]) => array.length > 0));
  }

  return {
    geometries,
    materialLibs,
  };
}


function mouseDown(ev){ 
    var x = ev.clientX;
    var y = ev.clientY;
    var rect = ev.target.getBoundingClientRect();
    if( rect.left <= x && x < rect.right && rect.top <= y && y < rect.bottom){
        mouseLastX = x;
        mouseLastY = y;
        mouseDragging = true;
    }
}

function mouseUp(ev){ 
    mouseDragging = false;
}

function mouseMove(ev){ 
    var x = ev.clientX;
    var y = ev.clientY;
    if( mouseDragging ){
        var factor = 100/canvas.height; //100 determine the spped you rotate the object
        var dx = factor * (x - mouseLastX);
        var dy = factor * (y - mouseLastY);

        angleX += dx; //yes, x for y, y for x, this is right
        angleY += dy;
    }
    mouseLastX = x;
    mouseLastY = y;

    //drawQuad();
    draw();
}

function initCubeTexture(posXName, negXName, posYName, negYName, 
  posZName, negZName, imgWidth, imgHeight)
{
var texture = gl.createTexture();
gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);

const faceInfos = [
{
target: gl.TEXTURE_CUBE_MAP_POSITIVE_X,
fName: posXName,
},
{
target: gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
fName: negXName,
},
{
target: gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
fName: posYName,
},
{
target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
fName: negYName,
},
{
target: gl.TEXTURE_CUBE_MAP_POSITIVE_Z,
fName: posZName,
},
{
target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Z,
fName: negZName,
},
];
faceInfos.forEach((faceInfo) => {
const {target, fName} = faceInfo;
// setup each face so it's immediately renderable
gl.texImage2D(target, 0, gl.RGBA, imgWidth, imgHeight, 0, 
gl.RGBA, gl.UNSIGNED_BYTE, null);

var image = new Image();
image.onload = function(){
gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
gl.texImage2D(target, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
};
image.src = fName;
});
gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);

return texture;
}

function keydown(ev){ 
  //implment keydown event here
  let rotateMatrix = new Matrix4();
  rotateMatrix.setRotate(angleY, 1, 0, 0);//for mouse rotation
  rotateMatrix.rotate(angleX, 0, 1, 0);//for mouse rotation
  var viewDir= new Vector3([cameraDirX, cameraDirY, cameraDirZ]);
  var newViewDir = rotateMatrix.multiplyVector3(viewDir);

  if( ThirdPersonPrespective ){
    if(ev.key == 'w'){
          _translate_straight += 1;
          marioFace = 180;
    }
    else if(ev.key == 's'){ 
        _translate_straight -= 1;
        marioFace = 0
    }
    else if(ev.key == 'a'){
        _translate_horizon += 1;
        marioFace = -90;
    }
    else if(ev.key == 'd'){
        _translate_horizon -= 1;
        marioFace = 90;
    }
  }
  else{
    if( marioFace == 180 ){
      if(ev.key == 'w'){
            cameraX += (newViewDir.elements[0] * 0.1);
            cameraY += (newViewDir.elements[1] * 0.1);
            cameraZ += (newViewDir.elements[2] * 0.1);
            _translate_straight += 1;
            marioFace = 180;
      }
      else if(ev.key == 's'){ 
          cameraX -= (newViewDir.elements[0] * 0.1);
          cameraY -= (newViewDir.elements[1] * 0.1);
          cameraZ -= (newViewDir.elements[2] * 0.1);
          marioFace = 0
      }
      else if(ev.key == 'a'){
          marioFace = -90;
      }
      else if(ev.key == 'd'){
          marioFace = 90;
      }
    }
    else if( marioFace == 0 ){
      if(ev.key == 'w'){
            cameraX += (newViewDir.elements[0] * 0.1);
            cameraY += (newViewDir.elements[1] * 0.1);
            cameraZ += (newViewDir.elements[2] * 0.1);
            _translate_straight -= 1;
            marioFace = 0;
      }
      else if(ev.key == 's'){
          marioFace = 180
      }
      else if(ev.key == 'a'){
          marioFace = 90;
      }
      else if(ev.key == 'd'){
          marioFace = -90;
      }
    }
    else if( marioFace == 90 ){
      if(ev.key == 'w'){
            cameraX += (newViewDir.elements[0] * 0.1);
            cameraY += (newViewDir.elements[1] * 0.1);
            cameraZ += (newViewDir.elements[2] * 0.1);
            _translate_horizon -= 1;
            marioFace = 90;
      }
      else if(ev.key == 's'){ 
          marioFace = -90
      }
      else if(ev.key == 'a'){
          marioFace = 180;
      }
      else if(ev.key == 'd'){
          marioFace = 0;
      }
    }
    else if( marioFace == -90 ){
      if(ev.key == 'w'){
            cameraX += (newViewDir.elements[0] * 0.1);
            cameraY += (newViewDir.elements[1] * 0.1);
            cameraZ += (newViewDir.elements[2] * 0.1);
            _translate_horizon += 1;
            marioFace = -90;
      }
      else if(ev.key == 's'){ 
          marioFace = 90
      }
      else if(ev.key == 'a'){
          marioFace = 0;
      }
      else if(ev.key == 'd'){
          marioFace = 180;
      }
    }
  }

  draw();
}

function initFrameBufferForCubemapRendering(gl){
  var texture = gl.createTexture();

  gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
  // 6 2D textures
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  for (let i = 0; i < 6; i++) {
    gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, 0, 
                  gl.RGBA, offScreenWidth, offScreenHeight, 0, gl.RGBA, 
                  gl.UNSIGNED_BYTE, null);
  }

  //create and setup a render buffer as the depth buffer
  var depthBuffer = gl.createRenderbuffer();
  gl.bindRenderbuffer(gl.RENDERBUFFER, depthBuffer);
  gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, 
                          offScreenWidth, offScreenHeight);

  //create and setup framebuffer: linke the depth buffer to it (no color buffer here)
  var frameBuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, 
                              gl.RENDERBUFFER, depthBuffer);

  frameBuffer.texture = texture;

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  return frameBuffer;
}

function renderCubeMap(camX, camY, camZ)
{
  //camera 6 direction to render 6 cubemap faces
  var ENV_CUBE_LOOK_DIR = [
      [1.0, 0.0, 0.0],
      [-1.0, 0.0, 0.0],
      [0.0, 1.0, 0.0],
      [0.0, -1.0, 0.0],
      [0.0, 0.0, 1.0],
      [0.0, 0.0, -1.0]
  ];

  //camera 6 look up vector to render 6 cubemap faces
  var ENV_CUBE_LOOK_UP = [
      [0.0, -1.0, 0.0],
      [0.0, -1.0, 0.0],
      [0.0, 0.0, 1.0],
      [0.0, 0.0, -1.0],
      [0.0, -1.0, 0.0],
      [0.0, -1.0, 0.0]
  ];

  gl.useProgram(program);
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.viewport(0, 0, offScreenWidth, offScreenHeight);
  gl.clearColor(0.4, 0.4, 0.4,1);
  for (var side = 0; side < 6;side++){
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, 
                            gl.TEXTURE_CUBE_MAP_POSITIVE_X+side, fbo.texture, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    let vpMatrix = new Matrix4();
    vpMatrix.setPerspective(90, 1, 1, 100);
    vpMatrix.lookAt(camX, camY, camZ,   
                    camX + ENV_CUBE_LOOK_DIR[side][0], 
                    camY + ENV_CUBE_LOOK_DIR[side][1],
                    camZ + ENV_CUBE_LOOK_DIR[side][2], 
                    ENV_CUBE_LOOK_UP[side][0],
                    ENV_CUBE_LOOK_UP[side][1],
                    ENV_CUBE_LOOK_UP[side][2]);
    var projMatrix = new Matrix4();
    projMatrix.setPerspective(90, 1, 1, 100);
    var viewMatrix = new Matrix4();
    viewMatrix.lookAt(camX, camY, camZ,   
                      camX + ENV_CUBE_LOOK_DIR[side][0], 
                      camY + ENV_CUBE_LOOK_DIR[side][1],
                      camZ + ENV_CUBE_LOOK_DIR[side][2], 
                      ENV_CUBE_LOOK_UP[side][0],
                      ENV_CUBE_LOOK_UP[side][1],
                      ENV_CUBE_LOOK_UP[side][2]);
    drawQuad( projMatrix, viewMatrix );
    drawRegularObjects(vpMatrix);
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

function initTexture(gl, img, imgName){
  var tex = gl.createTexture();
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
  gl.bindTexture(gl.TEXTURE_2D, tex);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

  // Upload the image into the texture.
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);

  textures[imgName] = tex;

  texCount++;
  if( texCount == imgName.length)draw();
}