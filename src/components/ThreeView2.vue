<template>
  <div id="container">
  </div>
</template>

<script>
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

import Stats from 'three/examples/jsm/libs/stats.module.js';
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';

export default {
  name: 'ThreeView',
  data() {
    return {
      scene: undefined, renderer: undefined, camera: undefined, stats: undefined,
      model: undefined, skeleton: undefined, mixer: undefined, clock: undefined,

      crossFadeControls: [],

      idleAction: undefined, walkAction: undefined, runAction: undefined,
      idleWeight: undefined, walkWeight: undefined, runWeight: undefined,
      actions: undefined, settings: undefined,

      singleStepMode: false,
      sizeOfNextStep: 0,
    }
  },
  mounted() {
    this.initThree()
  },
  methods: {
    initThree() {

      this.init();

    },
    init: function () {

      const container = document.getElementById('container');

      this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 1000);
      this.camera.position.set(1, 2, - 3);
      this.camera.lookAt(0, 1, 0);

      this.clock = new THREE.Clock();

      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0xa0a0a0);
      this.scene.fog = new THREE.Fog(0xa0a0a0, 10, 50);

      const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444);
      hemiLight.position.set(0, 20, 0);
      this.scene.add(hemiLight);

      const dirLight = new THREE.DirectionalLight(0xffffff);
      dirLight.position.set(- 3, 10, - 10);
      dirLight.castShadow = true;
      dirLight.shadow.camera.top = 2;
      dirLight.shadow.camera.bottom = - 2;
      dirLight.shadow.camera.left = - 2;
      dirLight.shadow.camera.right = 2;
      dirLight.shadow.camera.near = 0.1;
      dirLight.shadow.camera.far = 40;
      this.scene.add(dirLight);

      // scene.add( new THREE.CameraHelper( dirLight.shadow.camera ) );

      // ground
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshPhongMaterial({ color: 0x999999, depthWrite: false }));
      mesh.rotation.x = - Math.PI / 2;
      mesh.receiveShadow = true;
      this.scene.add(mesh);

      let _that = this;
      const loader = new GLTFLoader();
      loader.load('./models/gltf/Soldier.glb', function (gltf) {

        _that.model = gltf.scene;
        _that.scene.add(_that.model);

        _that.model.traverse(function (object) {

          if (object.isMesh) object.castShadow = true;

        });

        //
        _that.skeleton = new THREE.SkeletonHelper(_that.model);
        _that.skeleton.visible = false;
        _that.scene.add(_that.skeleton);

        //
        _that.createPanel();

        //
        const animations = gltf.animations;

        _that.mixer = new THREE.AnimationMixer(_that.model);

        _that.idleAction = _that.mixer.clipAction(animations[0]);
        _that.walkAction = _that.mixer.clipAction(animations[3]);
        _that.runAction = _that.mixer.clipAction(animations[1]);

        _that.actions = [_that.idleAction, _that.walkAction, _that.runAction];

        _that.activateAllActions();

        _that.animate();

      });

      this.renderer = new THREE.WebGLRenderer({ antialias: true });
      this.renderer.setPixelRatio(window.devicePixelRatio);
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.renderer.outputEncoding = THREE.sRGBEncoding;
      this.renderer.shadowMap.enabled = true;
      container.appendChild(this.renderer.domElement);

      this.stats = new Stats();
      container.appendChild(this.stats.dom);

      window.addEventListener('resize', this.onWindowResize);

    },

    createPanel: function () {
      let _that = this;
      const panel = new GUI({ width: 310 });

      const folder1 = panel.addFolder('Visibility');
      const folder2 = panel.addFolder('Activation/Deactivation');
      const folder3 = panel.addFolder('Pausing/Stepping');
      const folder4 = panel.addFolder('Crossfading');
      const folder5 = panel.addFolder('Blend Weights');
      const folder6 = panel.addFolder('General Speed');

      _that.settings = {
        'show model': true,
        'show skeleton': false,
        'deactivate all': _that.deactivateAllActions,
        'activate all': _that.activateAllActions,
        'pause/continue': _that.pauseContinue,
        'make single step': _that.toSingleStepMode,
        'modify step size': 0.05,
        'from walk to idle': function () {

          _that.prepareCrossFade(_that.walkAction, _that.idleAction, 1.0);

        },
        'from idle to walk': function () {

          _that.prepareCrossFade(_that.idleAction, _that.walkAction, 0.5);

        },
        'from walk to run': function () {

          _that.prepareCrossFade(_that.walkAction, _that.runAction, 2.5);

        },
        'from run to walk': function () {

          _that.prepareCrossFade(_that.runAction, _that.walkAction, 5.0);

        },
        'use default duration': true,
        'set custom duration': 3.5,
        'modify idle weight': 0.0,
        'modify walk weight': 1.0,
        'modify run weight': 0.0,
        'modify time scale': 1.0
      };

      folder1.add(_that.settings, 'show model').onChange(_that.showModel);
      folder1.add(_that.settings, 'show skeleton').onChange(_that.showSkeleton);
      folder2.add(_that.settings, 'deactivate all');
      folder2.add(_that.settings, 'activate all');
      folder3.add(_that.settings, 'pause/continue');
      folder3.add(_that.settings, 'make single step');
      folder3.add(_that.settings, 'modify step size', 0.01, 0.1, 0.001);
      _that.crossFadeControls.push(folder4.add(_that.settings, 'from walk to idle'));
      _that.crossFadeControls.push(folder4.add(_that.settings, 'from idle to walk'));
      _that.crossFadeControls.push(folder4.add(_that.settings, 'from walk to run'));
      _that.crossFadeControls.push(folder4.add(_that.settings, 'from run to walk'));
      folder4.add(_that.settings, 'use default duration');
      folder4.add(_that.settings, 'set custom duration', 0, 10, 0.01);
      folder5.add(_that.settings, 'modify idle weight', 0.0, 1.0, 0.01).listen().onChange(function (weight) {

        _that.setWeight(_that.idleAction, weight);

      });
      folder5.add(_that.settings, 'modify walk weight', 0.0, 1.0, 0.01).listen().onChange(function (weight) {

        _that.setWeight(_that.walkAction, weight);

      });
      folder5.add(_that.settings, 'modify run weight', 0.0, 1.0, 0.01).listen().onChange(function (weight) {

        _that.setWeight(_that.runAction, weight);

      });
      folder6.add(_that.settings, 'modify time scale', 0.0, 1.5, 0.01).onChange(_that.modifyTimeScale);

      folder1.open();
      folder2.open();
      folder3.open();
      folder4.open();
      folder5.open();
      folder6.open();

    },

    showModel: function (visibility) {

      this.model.visible = visibility;

    },


    showSkeleton: function (visibility) {

      this.skeleton.visible = visibility;

    },


    modifyTimeScale: function (speed) {

      this.mixer.timeScale = speed;

    },

    deactivateAllActions: function () {

      this.actions.forEach(function (action) {
        action.stop();
      });

    },

    activateAllActions: function () {

      this.setWeight(this.idleAction, this.settings['modify idle weight']);
      this.setWeight(this.walkAction, this.settings['modify walk weight']);
      this.setWeight(this.runAction, this.settings['modify run weight']);

      this.actions.forEach(function (action) {
        action.play();
      });

    },

    pauseContinue: function () {

      if (this.singleStepMode) {
        this.singleStepMode = false;
        this.unPauseAllActions();
      } else {
        if (this.idleAction.paused) {
          this.unPauseAllActions();
        } else {
          this.pauseAllActions();
        }
      }

    },

    pauseAllActions: function () {

      this.actions.forEach(function (action) {
        action.paused = true;
      });

    },

    unPauseAllActions: function () {

      this.actions.forEach(function (action) {
        action.paused = false;
      });

    },

    toSingleStepMode: function () {

      this.unPauseAllActions();

      this.singleStepMode = true;
      this.sizeOfNextStep = this.settings['modify step size'];

    },

    prepareCrossFade: function (startAction, endAction, defaultDuration) {

      // Switch default / custom crossfade duration (according to the user's choice)
      const duration = this.setCrossFadeDuration(defaultDuration);

      // Make sure that we don't go on in singleStepMode, and that all actions are unpaused
      this.singleStepMode = false;
      this.unPauseAllActions();

      // If the current action is 'idle' (duration 4 sec), execute the crossfade immediately;
      // else wait until the current action has finished its current loop
      if (startAction === this.idleAction) {
        this.executeCrossFade(startAction, endAction, duration);
      } else {
        this.synchronizeCrossFade(startAction, endAction, duration);
      }

    },

    setCrossFadeDuration: function (defaultDuration) {

      // Switch default crossfade duration <-> custom crossfade duration
      if (this.settings['use default duration']) {
        return defaultDuration;
      } else {
        return this.settings['set custom duration'];
      }

    },

    synchronizeCrossFade: function (startAction, endAction, duration) {

      let _that = this;
      let onLoopFinished = function (event) {
        if (event.action === startAction) {
          _that.mixer.removeEventListener('loop', onLoopFinished);
          _that.executeCrossFade(startAction, endAction, duration);
        }
      }

      _that.mixer.addEventListener('loop', onLoopFinished);

    },

    executeCrossFade: function (startAction, endAction, duration) {

      // Not only the start action, but also the end action must get a weight of 1 before fading
      // (concerning the start action this is already guaranteed in this place)
      this.setWeight(endAction, 1);
      endAction.time = 0;

      // Crossfade with warping - you can also try without warping by setting the third parameter to false
      startAction.crossFadeTo(endAction, duration, true);

    },
    // This function is needed, since animationAction.crossFadeTo() disables its start action and sets
    // the start action's timeScale to ((start animation's duration) / (end animation's duration))

    setWeight: function (action, weight) {

      action.enabled = true;
      action.setEffectiveTimeScale(1);
      action.setEffectiveWeight(weight);

    },

    // Called by the render loop

    updateWeightSliders: function () {
      this.settings['modify idle weight'] = this.idleWeight;
      this.settings['modify walk weight'] = this.walkWeight;
      this.settings['modify run weight'] = this.runWeight;
    },
    // Called by the render loop
    updateCrossFadeControls: function () {
      if (this.idleWeight === 1 && this.walkWeight === 0 && this.runWeight === 0) {
        this.crossFadeControls[0].disable();
        this.crossFadeControls[1].enable();
        this.crossFadeControls[2].disable();
        this.crossFadeControls[3].disable();
      }

      if (this.idleWeight === 0 && this.walkWeight === 1 && this.runWeight === 0) {
        this.crossFadeControls[0].enable();
        this.crossFadeControls[1].disable();
        this.crossFadeControls[2].enable();
        this.crossFadeControls[3].disable();
      }

      if (this.idleWeight === 0 && this.walkWeight === 0 && this.runWeight === 1) {
        this.crossFadeControls[0].disable();
        this.crossFadeControls[1].disable();
        this.crossFadeControls[2].disable();
        this.crossFadeControls[3].enable();
      }

    },
    
    onWindowResize: function () {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    },

    animate: function () {

      // Render loop
      window.requestAnimationFrame(this.animate);

      this.idleWeight = this.idleAction.getEffectiveWeight();
      this.walkWeight = this.walkAction.getEffectiveWeight();
      this.runWeight = this.runAction.getEffectiveWeight();

      // Update the panel values if weights are modified from "outside" (by crossfadings)
      this.updateWeightSliders();

      // Enable/disable crossfade controls according to current weight values
      this.updateCrossFadeControls();

      // Get the time elapsed since the last frame, used for mixer update (if not in single step mode)
      let mixerUpdateDelta = this.clock.getDelta();

      // If in single step mode, make one step and then do nothing (until the user clicks again)
      if (this.singleStepMode) {
        mixerUpdateDelta = this.sizeOfNextStep;
        this.sizeOfNextStep = 0;
      }

      // Update the animation mixer, the stats panel, and render this frame
      this.mixer.update(mixerUpdateDelta);
      this.stats.update();
      this.renderer.render(this.scene, this.camera);

    }
  },
}
</script>

<style scoped>
#container {
  width: 100%;
  height: 100%;
  position: fixed;
  left: 0;
  top: 0;
}
</style>