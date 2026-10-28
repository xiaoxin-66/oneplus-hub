#include <iostream>
#include <fstream>
#include <string>
#include <vector>
#include <thread>
#include <chrono>
#include <cstdio>
#include <sstream>
#include <map>
#include <ctime>
#include <algorithm>
#include <unistd.h>
#include <cmath>
#include <dirent.h>

using namespace std;

// ---------- 基础文件操作与字符串处理 ----------
string read_file(const string& path) {
    ifstream file(path);
    if (!file.is_open()) return "";
    string content((istreambuf_iterator<char>(file)), istreambuf_iterator<char>());
    while (!content.empty() && (content.back() == '\n' || content.back() == '\r')) content.pop_back();
    return content;
}

// 【修复 3】安全写入，拦截空值和空路径
void write_file(const string& path, const string& value) {
    if (path.empty() || value.empty()) return; 
    ofstream file(path);
    if (file.is_open()) { file << value << "\n"; file.close(); }
}

bool file_exists(const string& path) { return access(path.c_str(), F_OK) != -1; }

// 增加 timeout，防止系统服务卡死
string exec_cmd(const char* cmd, int timeout_sec = 1) {
    char buffer[128]; string result = "";
    string full_cmd = "timeout " + to_string(timeout_sec) + " " + string(cmd) + " 2>/dev/null";
    FILE* pipe = popen(full_cmd.c_str(), "r");
    if (!pipe) return "";
    while (fgets(buffer, sizeof(buffer), pipe) != NULL) result += buffer;
    pclose(pipe);
    while (!result.empty() && (result.back() == '\n' || result.back() == '\r')) result.pop_back();
    return result;
}

// 【修复 6】去除首尾空格和回车（防 Windows 记事本导致的匹配失败）
string trim(const string& str) {
    size_t first = str.find_first_not_of(" \t\r\n");
    if (string::npos == first) return "";
    size_t last = str.find_last_not_of(" \t\r\n");
    return str.substr(first, (last - first + 1));
}

// 【修复 6】JS 字符转义（防止机型名称带引号破坏 JS 结构）
string escape_js(const string& str) {
    string res = "";
    for (char c : str) {
        if (c == '"' || c == '\\') res += '\\';
        res += c;
    }
    return res;
}

// ---------- 识别 SOC & 设备信息 ----------
string soc_type = "snapdragon";
string dev_model = "", dev_os = "", dev_kernel = "";
string mali_gov_path = "";

void detect_device() {
    string platform = exec_cmd("getprop ro.board.platform");
    string hardware = exec_cmd("getprop ro.hardware");
    if (platform.find("mt") != string::npos || hardware.find("mt") != string::npos) {
        soc_type = "mediatek";
    }
    dev_model = exec_cmd("getprop ro.product.model");
    dev_os = "Android " + exec_cmd("getprop ro.build.version.release");
    dev_kernel = exec_cmd("uname -r");

    // 【修复 4】动态遍历查找天玑 GPU 节点
    if (soc_type == "mediatek") {
        DIR *dir = opendir("/sys/class/devfreq");
        if (dir) {
            struct dirent *ent;
            while ((ent = readdir(dir)) != nullptr) {
                string name = ent->d_name;
                if (name.find("mali") != string::npos || name.find("gpu") != string::npos) {
                    string gov_path = "/sys/class/devfreq/" + name + "/governor";
                    if (file_exists(gov_path)) {
                        mali_gov_path = gov_path;
                        break;
                    }
                }
            }
            closedir(dir);
        }
    }
}

// ---------- CPU 节点与策略 ----------
string cpu_base = ""; string policy_prefix = "";
vector<int> active_policies; // 动态探测存在的 policy

void init_cpu_paths() {
    // 【修复 1】CPU 路径统一探测
    if (access("/sys/devices/system/cpu/cpufreq/policy0", F_OK) != -1) {
        cpu_base = "/sys/devices/system/cpu/cpufreq/"; policy_prefix = "policy";
    } else if (access("/sys/devices/system/cpu/cpu0/cpufreq", F_OK) != -1) {
        cpu_base = "/sys/devices/system/cpu/"; policy_prefix = "cpu";
    }

    if (!cpu_base.empty()) {
        for (int i = 0; i <= 10; i++) {
            string path = cpu_base + policy_prefix + to_string(i);
            if (file_exists(path + "/scaling_max_freq")) {
                active_policies.push_back(i);
            }
        }
    }
}

string get_freq_by_percent(int policy_num, int pct) {
    // 【修复 3】严格判空
    if (cpu_base.empty()) return "";
    string path = cpu_base + policy_prefix + to_string(policy_num) + "/scaling_available_frequencies";
    string freqs = read_file(path);
    if (freqs.empty()) return "";
    
    stringstream ss(freqs); string freq; vector<string> freq_list;
    while (ss >> freq) freq_list.push_back(freq);
    if (freq_list.empty()) return "";
    
    int target_idx = (freq_list.size() * pct) / 100;
    if (target_idx < 1) target_idx = 1;
    if (target_idx > (int)freq_list.size()) target_idx = freq_list.size();
    return freq_list[target_idx - 1];
}

string get_freq_by_mode(int policy_num, string mode) {
    if (cpu_base.empty()) return "";
    string path = cpu_base + policy_prefix + to_string(policy_num) + "/scaling_available_frequencies";
    string freqs = read_file(path);
    if (freqs.empty()) return "";
    
    stringstream ss(freqs); string freq; vector<string> freq_list;
    while (ss >> freq) freq_list.push_back(freq);
    if (freq_list.empty()) return "";
    
    int n = freq_list.size();
    if (mode == "full") return freq_list[n - 1];
    if (mode == "mid") return freq_list[n / 2];
    if (mode == "second") return n >= 2 ? freq_list[n - 2] : freq_list[n - 1];
    return freq_list[n - 1];
}

void sysfs_write(string path, string value) { write_file(path, value); }

// ---------- 硬件状态读取 ----------
int get_cpu_temp() {
    int max_temp = 0;
    for (int i = 0; i < 50; i++) {
        string base = "/sys/class/thermal/thermal_zone" + to_string(i);
        string type = read_file(base + "/type"); string val = read_file(base + "/temp");
        if (!type.empty() && !val.empty()) {
            string t_lower = type; for (char &c : t_lower) c = tolower(c);
            if (t_lower.find("cpu") != string::npos || t_lower.find("cpuss") != string::npos) {
                try { int t = stoi(val); if (t > 1000) t /= 1000; if (t > 20 && t < 100 && t > max_temp) max_temp = t; } catch (...) {}
            }
        }
    }
    return max_temp;
}

int get_gpu_temp() {
    int max_temp = 0;
    for (int i = 0; i < 50; i++) {
        string base = "/sys/class/thermal/thermal_zone" + to_string(i);
        string type = read_file(base + "/type"); string val = read_file(base + "/temp");
        if (!type.empty() && !val.empty()) {
            string t_lower = type; for (char &c : t_lower) c = tolower(c);
            if (t_lower.find("gpu") != string::npos) {
                try { int t = stoi(val); if (t > 1000) t /= 1000; if (t > 20 && t < 100 && t > max_temp) max_temp = t; } catch (...) {}
            }
        }
    }
    return max_temp;
}

int get_battery_temp() {
    string val = read_file("/sys/class/power_supply/battery/temp");
    if (!val.empty()) { try { return stoi(val) / 10; } catch (...) {} }
    return 0;
}

string get_charge_status() {
    string status = read_file("/sys/class/power_supply/battery/status");
    if (status == "Charging" || status == "Full") return "充电中";
    return "未充电";
}

// 【修复 2】FPS 时间差方向修复
int get_current_fps() {
    string raw = exec_cmd("dumpsys SurfaceFlinger --latency | awk 'NR>1 {print $2}' | grep -v '^0$' | tail -n 60", 1);
    if (raw.empty()) return 0;
    stringstream ss(raw); string line; vector<long long> ts;
    while(getline(ss, line)) { try { long long t = stoll(line); if(t > 0) ts.push_back(t); } catch(...) {} }
    if (ts.size() < 2) return 0;
    
    // 用绝对差值，无论时间戳正序还是倒序都能算对
    long long diff = abs(ts.front() - ts.back());
    if (diff <= 0) return 0;
    
    double sec = diff / 1e9;
    int fps = round((ts.size() - 1) / sec);
    if (fps > 144) fps = 144;
    if (fps < 10) fps = 0;
    return fps;
}

// ---------- 配置读取 ----------
map<string, string> config;
void load_config() {
    config.clear();
    ifstream file("/data/adb/xiaobu_dispatch.conf");
    string line;
    while (getline(file, line)) {
        size_t pos = line.find('=');
        if (pos != string::npos) {
            string key = trim(line.substr(0, pos)); 
            string val = trim(line.substr(pos + 1));
            if (!val.empty() && val.front() == '"' && val.back() == '"') val = val.substr(1, val.length() - 2);
            config[key] = val;
        }
    }
}
int get_conf_int(const string& key, int def_val) {
    if (config.find(key) != config.end() && !config[key].empty()) { try { return stoi(config[key]); } catch (...) {} }
    return def_val;
}
string get_conf_str(const string& key, const string& def_val) {
    if (config.find(key) != config.end() && !config[key].empty()) return config[key];
    return def_val;
}

int main() {
    freopen("/dev/null", "w", stdout); freopen("/dev/null", "w", stderr);
    detect_device();
    init_cpu_paths();
    
    string current_mode = ""; string current_tier = ""; int pid = getpid(); 
    int current_fps = 0;
    int loop_counter = 0;
    
    // 探测 core_ctl 节点
    string core_ctl_path = "";
    for (int i = 4; i <= 7; i++) {
        string path = "/sys/devices/system/cpu/cpu" + to_string(i) + "/core_ctl";
        if (access(path.c_str(), F_OK) != -1) {
            core_ctl_path = path;
            break;
        }
    }

    while (true) {
        if (file_exists("/data/adb/xiaobu_dispatch/reload.flag")) {
            system("rm -f /data/adb/xiaobu_dispatch/reload.flag");
            current_tier = ""; 
        }

        load_config();
        string fg = exec_cmd("dumpsys window | grep -E 'mCurrentFocus|mFocusedApp' | grep -oE '[a-zA-Z0-9._]+/' | cut -d/ -f1 | head -n 1");
        
        bool is_game = false;
        ifstream game_list("/data/adb/modules/xiaobu_dispatch_ext/common/game_list.txt");
        string line;
        // 【修复 6】使用 trim 处理游戏包名
        while (getline(game_list, line)) { 
            line = trim(line);
            if (!line.empty() && line[0] != '#' && line == fg) { is_game = true; break; } 
        }
        
        int cpu_temp = get_cpu_temp(); int gpu_temp = get_gpu_temp(); int soc_temp = max(cpu_temp, gpu_temp);
        int bat_temp = get_battery_temp(); string charge_status = get_charge_status();
        
        if (loop_counter % 5 == 0) current_fps = get_current_fps();
        loop_counter++;

        string new_tier = "cool";
        if (is_game) {
            int warm_enter = get_conf_int("GAME_WARM_ENTER", 58); int hot_enter = get_conf_int("GAME_HOT_ENTER", 65);
            if (soc_temp >= hot_enter) new_tier = "hot"; else if (soc_temp >= warm_enter) new_tier = "warm";
        } else {
            int hot_temp = get_conf_int("DAILY_HOT_TEMP", 55); new_tier = (soc_temp >= hot_temp) ? "hot" : "normal";
        }

        string target_mode = is_game ? "game" : "daily";
        string current_preset = get_conf_str("CURRENT_PRESET", "custom");
        
        if (current_mode != target_mode || current_tier != new_tier) {
            if (is_game) {
                int game_clamp = get_conf_int("GAME_COOL_CLAMP", 640);
                if (new_tier == "warm") game_clamp = get_conf_int("GAME_WARM_CLAMP", 448);
                if (new_tier == "hot")  game_clamp = get_conf_int("GAME_HOT_CLAMP", 320);
                sysfs_write("/proc/sys/kernel/sched_util_clamp_min", to_string(game_clamp));

                int up_rate = get_conf_int("CPU_UP_RATE", 0);
                int down_rate = get_conf_int("CPU_DOWN_RATE", 2000);
                
                // 【修复 1】统一循环 active_policies
                for (int p : active_policies) {
                    string path = cpu_base + policy_prefix + to_string(p) + "/schedutil/up_rate_limit_us";
                    if (file_exists(path)) sysfs_write(path, to_string(up_rate));
                    path = cpu_base + policy_prefix + to_string(p) + "/schedutil/down_rate_limit_us";
                    if (file_exists(path)) sysfs_write(path, to_string(down_rate));
                    
                    string freq = get_freq_by_mode(p, "full");
                    if (!freq.empty()) sysfs_write(cpu_base + policy_prefix + to_string(p) + "/scaling_max_freq", freq);
                }
                
                if (core_ctl_path != "") {
                    int min_cores = get_conf_int("GAME_MIN_CORES", 2);
                    sysfs_write(core_ctl_path + "/min_cpus", to_string(min_cores));
                }

                int gpu_limit = get_conf_int("GAME_GPU_LIMIT", 1);
                if (soc_type == "snapdragon" && file_exists("/sys/class/kgsl/kgsl-3d0/max_pwrlevel")) {
                    if (new_tier == "warm") gpu_limit += 1;
                    if (new_tier == "hot")  gpu_limit += 2;
                    sysfs_write("/sys/class/kgsl/kgsl-3d0/max_pwrlevel", to_string(gpu_limit));
                    sysfs_write("/sys/class/kgsl/kgsl-3d0/devfreq/governor", "msm-adreno-tz");
                } else if (soc_type == "mediatek" && !mali_gov_path.empty()) {
                    sysfs_write(mali_gov_path, "simple_ondemand");
                }

            } else {
                int daily_clamp = get_conf_int("DAILY_CLAMP", 256);
                sysfs_write("/proc/sys/kernel/sched_util_clamp_min", to_string(daily_clamp));
                
                int little_pct = get_conf_int("DAILY_LITTLE_PCT", 70);
                string little_freq = get_freq_by_percent(0, little_pct);
                if (!little_freq.empty()) sysfs_write(cpu_base + policy_prefix + "0/scaling_max_freq", little_freq);
                
                string big_mode = get_conf_str("DAILY_BIG_MODE", "second");
                for (int p : active_policies) {
                    if (p == 0) continue;
                    string big_freq = get_freq_by_mode(p, big_mode);
                    if (!big_freq.empty()) sysfs_write(cpu_base + policy_prefix + to_string(p) + "/scaling_max_freq", big_freq);
                }

                if (core_ctl_path != "") {
                    sysfs_write(core_ctl_path + "/min_cpus", "1");
                }

                // 【修复 5】日常 GPU 解封语义确认：0 为满血，不写空值
                if (soc_type == "snapdragon" && file_exists("/sys/class/kgsl/kgsl-3d0/max_pwrlevel")) {
                    sysfs_write("/sys/class/kgsl/kgsl-3d0/max_pwrlevel", "0");
                }
            }
            current_mode = target_mode; current_tier = new_tier;
        }

        // 【修复 6】JS 转义与高频写入降频
        // 只在状态或温度变化时，或者每 10 秒（10次循环）才写入文件，大幅减少闪存磨损
        static string last_stateStr = "";
        time_t now = time(0);
        string stateStr = to_string(pid) + "|" + current_mode + "|" + current_tier + "|" + 
                          to_string(cpu_temp) + "|" + to_string(gpu_temp) + "|" + 
                          to_string(bat_temp) + "|" + charge_status + "|" + 
                          to_string(current_fps) + "|" + to_string(now) + "|" + 
                          soc_type + "|" + current_preset + "|" + 
                          dev_model + "|" + dev_os + "|" + dev_kernel;

        if (stateStr != last_stateStr || loop_counter % 10 == 0) {
            write_file("/data/adb/xiaobu_state", stateStr);
            string js_safe_state = escape_js(stateStr);
            write_file("/data/adb/modules/xiaobu_dispatch_ext/webroot/state.js", "window.xiaobuState = \"" + js_safe_state + "\";");
            last_stateStr = stateStr;
        }

        this_thread::sleep_for(chrono::seconds(1)); 
    }
    return 0;
}